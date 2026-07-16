import React, { useMemo, useState } from "react";
import { Alert, App, Button, Card, Empty, Select, Space, Spin, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CloudDownloadOutlined, DeleteOutlined, MergeCellsOutlined, ReloadOutlined, SwapOutlined, SyncOutlined, WarningOutlined } from "@ant-design/icons";
import { STATUS_COLORS } from "../../theme/semantic-colors";
import { RouteTabs } from "../common/RouteTabs";
import { PageHeader } from "../common/PageHeader";
import { formatDateTime } from "../../utils/format";
import { openDetail } from "../../utils/open-detail";
import { detectDocumentType } from "../../utils/detect-document-type";
import { MergeModal } from "./MergeDuplicates";
import {
  AuditMoodleUser,
  AuditUserRef,
  CleanupCandidate,
  IncorrectLinkFinding,
  MoodleAuditReport,
  NoCoursesFinding,
  OrphanFinding,
  UnlinkedFinding,
  UnverifiableFinding,
  UsernameMismatchFinding,
  useDeleteFromMoodleMutation,
  useFixUsernamesMutation,
  useMoodleAuditRefreshMutation,
  useMoodleAuditReportQuery,
  useOrphanCleanupMutation,
  useRefreshEnrolmentsMutation,
  useRelinkMutation,
  useSyncStatusMutation,
} from "../../hooks/api/moodle-audit/useMoodleAudit";

const { Text } = Typography;

const apiErrorMessage = (e: unknown, fallback: string): string => {
  const maybe = e as { response?: { data?: { message?: string } } } | undefined;
  return maybe?.response?.data?.message || fallback;
};

const fullName = (u: AuditUserRef | null) =>
  u ? [u.name, u.first_surname, u.second_surname].filter(Boolean).join(" ").trim() || "(sin nombre)" : "(desconocido)";

// DNI/NIE con la letra de control validada: los inválidos, en rojo y negrita
const DniText: React.FC<{ value: string | null }> = ({ value }) => {
  if (!value) return <>sin DNI</>;
  if (detectDocumentType(value) !== undefined) return <>{value}</>;
  return <Text strong type="danger" style={{ fontSize: "inherit" }}>{value}</Text>;
};

// Usuario local como enlace a su ficha (nueva pestaña, gesto estándar de la app)
const LocalUserCell: React.FC<{ user: AuditUserRef | null }> = ({ user }) => {
  if (!user) return <Text type="secondary">—</Text>;
  return (
    <Space direction="vertical" size={0}>
      <Typography.Link onClick={() => openDetail(`/users/${user.id_user}`)}>
        #{user.id_user} {fullName(user)}
      </Typography.Link>
      <Text type="secondary" style={{ fontSize: 12 }}>
        <DniText value={user.dni} /> · {user.courses_count}c · {user.groups_count}g · {user.moodle_count}m
      </Text>
    </Space>
  );
};

const MoodleUserCell: React.FC<{ moodle: AuditMoodleUser }> = ({ moodle }) => (
  <Space direction="vertical" size={0}>
    <Text>
      {moodle.username}
      {moodle.suspended && <Tag color={STATUS_COLORS.inactive} style={{ marginLeft: 8 }}>suspendido</Tag>}
    </Text>
    <Text type="secondary" style={{ fontSize: 12 }}>
      {moodle.fullname} · id {moodle.moodle_id}
      {moodle.dni_keys.map(k => (
        <React.Fragment key={k}>
          {" · "}
          <DniText value={k} />
        </React.Fragment>
      ))}
    </Text>
  </Space>
);

// ---- Pestaña: vínculos incorrectos (reasignar o fusionar) ----
const IncorrectLinksTab: React.FC<{ items: IncorrectLinkFinding[] }> = ({ items }) => {
  const { message, modal } = App.useApp();
  const [mergeTarget, setMergeTarget] = useState<{ winnerId: number; loserId: number } | null>(null);
  const { mutateAsync: relink, isPending: isRelinking } = useRelinkMutation();

  const handleRelink = (r: IncorrectLinkFinding) => {
    modal.confirm({
      title: "Reasignar vínculo de Moodle",
      width: 560,
      content: (
        <Space direction="vertical" size={4}>
          <Text>
            La cuenta <b>{r.moodle.username}</b> pasa de <b>#{r.linkedUser.id_user} {fullName(r.linkedUser)}</b> a{" "}
            <b>#{r.expectedUser.id_user} {fullName(r.expectedUser)}</b> (correcto por DNI).
          </Text>
          <Text type="secondary">
            Se mueven solo las matrículas de esta cuenta de Moodle y las membresías de grupo de esos cursos.
            Ninguna ficha se borra ni se fusionan más datos. No toca Moodle ni hace llamadas.
          </Text>
        </Space>
      ),
      okText: "Reasignar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const result = await relink(r.id_moodle_user);
          message.success(
            `Vínculo reasignado a #${result.to_user}: ${result.courses.moved + result.courses.merged} matrículas y ${result.groups.moved + result.groups.merged} grupos movidos`,
          );
        } catch (e) {
          message.error(apiErrorMessage(e, "No se pudo reasignar el vínculo"));
        }
      },
    });
  };

  const columns: ColumnsType<IncorrectLinkFinding> = [
    { title: "Cuenta Moodle", key: "moodle", render: (_v, r) => <MoodleUserCell moodle={r.moodle} /> },
    { title: "Vinculado ahora (incorrecto)", key: "linked", render: (_v, r) => <LocalUserCell user={r.linkedUser} /> },
    { title: "Correcto por DNI", key: "expected", render: (_v, r) => <LocalUserCell user={r.expectedUser} /> },
    {
      title: "Nombres",
      key: "names",
      width: 120,
      render: (_v, r) =>
        r.nameMatch
          ? <Tag color={STATUS_COLORS.active}>coinciden</Tag>
          : <Tag color={STATUS_COLORS.warning} icon={<WarningOutlined />}>revisar</Tag>,
    },
    {
      title: "Acción",
      key: "action",
      width: 260,
      render: (_v, r) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<SwapOutlined />}
            loading={isRelinking}
            onClick={() => handleRelink(r)}
          >
            Reasignar →
          </Button>
          <Button
            size="small"
            icon={<MergeCellsOutlined />}
            onClick={() => setMergeTarget({ winnerId: r.expectedUser.id_user, loserId: r.linkedUser.id_user })}
          >
            Fusionar →
          </Button>
        </Space>
      ),
    },
  ];

  if (items.length === 0) return <Empty description="Ningún vínculo incorrecto" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="La cuenta de Moodle está vinculada a un usuario local distinto del que casa por su DNI."
        description={
          <span>
            <b>Reasignar →</b> (personas distintas, solo el vínculo está mal): mueve la cuenta de Moodle, sus matrículas
            y los grupos de esos cursos al usuario correcto; nadie se borra.{" "}
            <b>Fusionar →</b> (las dos fichas son la misma persona): el usuario correcto absorbe TODO lo del vinculado
            y este se elimina.
          </span>
        }
      />
      <Table size="small" rowKey="id_moodle_user" columns={columns} dataSource={items} scroll={{ x: "max-content" }} />
      {mergeTarget && (
        <MergeModal winnerId={mergeTarget.winnerId} loserId={mergeTarget.loserId} onClose={() => setMergeTarget(null)} />
      )}
    </>
  );
};

// ---- Pestaña: huérfanos (la cuenta ya no existe en Moodle) ----
const OrphansTab: React.FC<{ items: OrphanFinding[] }> = ({ items }) => {
  const { message, modal } = App.useApp();
  const { mutateAsync: cleanup, isPending } = useOrphanCleanupMutation();
  const [selected, setSelected] = useState<React.Key[]>([]);

  const removeOrphans = (ids: number[]) => {
    modal.confirm({
      title: ids.length === 1 ? "Eliminar vínculo huérfano" : `Eliminar ${ids.length} vínculos huérfanos`,
      content:
        "Se conservan las matrículas y su progreso (solo se desconecta la cuenta de Moodle inexistente). Se borran los vínculos con token de esa cuenta. Esta acción no toca Moodle.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        let ok = 0;
        const errors: string[] = [];
        for (const id of ids) {
          try {
            await cleanup(id);
            ok++;
          } catch (e) {
            errors.push(apiErrorMessage(e, `Vínculo ${id}`));
          }
        }
        setSelected([]);
        if (ok > 0) message.success(`${ok} vínculo${ok === 1 ? "" : "s"} huérfano${ok === 1 ? "" : "s"} eliminado${ok === 1 ? "" : "s"}`);
        if (errors.length > 0) message.error(`No se pudieron eliminar ${errors.length}: ${errors[0]}`);
      },
    });
  };

  const columns: ColumnsType<OrphanFinding> = [
    {
      title: "Username Moodle",
      key: "u",
      render: (_v, r) => (
        <Space size={4}>
          {r.moodle_username}
          {r.marked_deleted && <Tag color={STATUS_COLORS.neutral}>lápida marcada</Tag>}
        </Space>
      ),
    },
    { title: "Moodle ID", dataIndex: "moodle_id", key: "mid", width: 100 },
    { title: "Usuario local", key: "user", render: (_v, r) => <LocalUserCell user={r.user} /> },
    {
      title: "Matrículas",
      dataIndex: "user_course_refs",
      key: "uc",
      width: 110,
      render: v => (v > 0 ? <Tag color={STATUS_COLORS.processing}>{v}</Tag> : <Text type="secondary">0</Text>),
    },
    {
      title: "Tokens",
      dataIndex: "token_links",
      key: "tk",
      width: 100,
      render: v =>
        v > 0 ? <Tag color={STATUS_COLORS.warning} icon={<WarningOutlined />}>{v}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: "Otras cuentas",
      dataIndex: "other_accounts",
      key: "oa",
      width: 120,
      render: (v, r) => (
        <span>
          {v}
          {r.is_main_user && v === 0 && (
            <Tag color={STATUS_COLORS.warning} style={{ marginLeft: 8 }}>se queda sin Moodle</Tag>
          )}
        </span>
      ),
    },
    {
      title: "Acción",
      key: "action",
      width: 120,
      render: (_v, r) => (
        <Button size="small" danger icon={<DeleteOutlined />} loading={isPending} onClick={() => removeOrphans([r.id_moodle_user])}>
          Eliminar
        </Button>
      ),
    },
  ];

  if (items.length === 0) return <Empty description="Ningún vínculo huérfano" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Vínculos de la BD cuya cuenta ya no existe en Moodle (borrada allí)."
        description="Al eliminarlos se conservan las matrículas y el progreso histórico; solo se desconecta la cuenta y se borran sus tokens. Si un usuario aparece también en «Vínculos incorrectos», fusiona primero."
      />
      <Space style={{ marginBottom: 12 }}>
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={selected.length === 0}
          loading={isPending}
          onClick={() => removeOrphans(selected.map(Number))}
        >
          Eliminar seleccionados ({selected.length})
        </Button>
      </Space>
      <Table
        size="small"
        rowKey="id_moodle_user"
        columns={columns}
        dataSource={items}
        scroll={{ x: "max-content" }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
      />
    </>
  );
};

// ---- Pestaña: usernames desactualizados ----
const UsernameMismatchesTab: React.FC<{ items: UsernameMismatchFinding[] }> = ({ items }) => {
  const { message, modal } = App.useApp();
  const { mutateAsync: fix, isPending } = useFixUsernamesMutation();
  const [selected, setSelected] = useState<React.Key[]>([]);

  const runFix = (ids?: number[]) => {
    const count = ids ? ids.length : items.length;
    modal.confirm({
      title: `Actualizar ${count} username${count === 1 ? "" : "s"} de Moodle`,
      content:
        "Se copia el username real de Moodle (del snapshot descargado) a la BD. No modifica nada en Moodle ni hace llamadas.",
      okText: "Actualizar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const result = await fix(ids);
          setSelected([]);
          if (result.updated > 0) message.success(`${result.updated} username${result.updated === 1 ? "" : "s"} actualizado${result.updated === 1 ? "" : "s"}`);
          if (result.errors.length > 0) message.warning(`${result.errors.length} no se pudieron actualizar: ${result.errors[0].message}`);
          if (result.updated === 0 && result.errors.length === 0) message.info("No había nada que actualizar");
        } catch (e) {
          message.error(apiErrorMessage(e, "No se pudieron actualizar los usernames"));
        }
      },
    });
  };

  const columns: ColumnsType<UsernameMismatchFinding> = [
    { title: "Usuario local", key: "user", render: (_v, r) => <LocalUserCell user={r.linkedUser} /> },
    {
      title: "Username guardado (obsoleto)",
      dataIndex: "stored_username",
      key: "stored",
      render: v => <Text delete type="secondary">{v}</Text>,
    },
    {
      title: "Username real en Moodle",
      dataIndex: "real_username",
      key: "real",
      render: v => <Text strong>{v}</Text>,
    },
    { title: "Moodle ID", key: "mid", width: 100, render: (_v, r) => r.moodle.moodle_id },
    {
      title: "Acción",
      key: "action",
      width: 130,
      render: (_v, r) => (
        <Button size="small" icon={<SyncOutlined />} loading={isPending} onClick={() => runFix([r.id_moodle_user])}>
          Actualizar
        </Button>
      ),
    },
  ];

  if (items.length === 0) return <Empty description="Todos los usernames están al día" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Vínculos correctos por moodle_id cuyo username guardado no coincide con el real de Moodle."
        description="La actualización copia el username real del snapshot a la BD (sin llamadas y sin tocar Moodle). Si el username real lo tiene ocupado otro vínculo desactualizado, se resuelve solo en la misma pasada."
      />
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<SyncOutlined />} loading={isPending} onClick={() => runFix()}>
          Actualizar todos ({items.length})
        </Button>
        <Button
          icon={<SyncOutlined />}
          disabled={selected.length === 0}
          loading={isPending}
          onClick={() => runFix(selected.map(Number))}
        >
          Actualizar seleccionados ({selected.length})
        </Button>
      </Space>
      <Table
        size="small"
        rowKey="id_moodle_user"
        columns={columns}
        dataSource={items}
        scroll={{ x: "max-content" }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
      />
    </>
  );
};

// ---- Pestaña: limpieza de Moodle (usuarios sin ningún curso en Moodle) ----
type ActivityFilter = "all" | "never" | "6m" | "12m" | "24m";

const ACTIVITY_OPTIONS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "Cualquier actividad" },
  { value: "never", label: "Nunca conectados" },
  { value: "6m", label: "Sin conectar > 6 meses (o nunca)" },
  { value: "12m", label: "Sin conectar > 12 meses (o nunca)" },
  { value: "24m", label: "Sin conectar > 24 meses (o nunca)" },
];

const monthsAgoEpoch = (months: number) => Math.floor(Date.now() / 1000) - months * 30 * 24 * 3600;

const CleanupTab: React.FC<{
  items: CleanupCandidate[];
  enrolments: MoodleAuditReport["enrolments"];
  onDownloadEnrolments: () => void;
  isDownloading: boolean;
}> = ({ items, enrolments, onDownloadEnrolments, isDownloading }) => {
  const { message, modal } = App.useApp();
  const { mutateAsync: deleteFromMoodle, isPending: isDeleting } = useDeleteFromMoodleMutation();
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [activity, setActivity] = useState<ActivityFilter>("12m");

  const filtered = useMemo(() => {
    if (activity === "all") return items;
    if (activity === "never") return items.filter(c => c.never_accessed);
    const cutoff = monthsAgoEpoch(activity === "6m" ? 6 : activity === "12m" ? 12 : 24);
    return items.filter(c => c.never_accessed || c.moodle.lastaccess < cutoff);
  }, [items, activity]);

  // Al cambiar el filtro puede quedar seleccionado algo ya no visible: limpiar
  const visibleSelected = useMemo(() => {
    const visible = new Set(filtered.map(c => c.moodle.moodle_id));
    return selected.filter(k => visible.has(Number(k)));
  }, [selected, filtered]);

  const runDelete = (moodleIds: number[]) => {
    modal.confirm({
      title: `Borrar ${moodleIds.length} usuario${moodleIds.length === 1 ? "" : "s"} DE MOODLE`,
      width: 560,
      content:
        "IRREVERSIBLE: se borran en Moodle (pierden el acceso y desaparecen de la plataforma). En la BD local no se borra nada: sus vínculos quedan marcados como «borrado en Moodle» conservando el histórico. Coste: ~1 llamada por cada 200 usuarios.",
      okText: "Borrar de Moodle",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const result = await deleteFromMoodle(moodleIds);
          setSelected([]);
          if (result.deleted > 0) {
            message.success(
              `${result.deleted} usuario${result.deleted === 1 ? "" : "s"} borrado${result.deleted === 1 ? "" : "s"} de Moodle (${result.moodleCalls} llamada${result.moodleCalls === 1 ? "" : "s"}; ${result.marked_local} lápida${result.marked_local === 1 ? "" : "s"} local${result.marked_local === 1 ? "" : "es"})`,
            );
          }
          if (result.errors.length > 0) {
            message.warning(`${result.errors.length} rechazado${result.errors.length === 1 ? "" : "s"}: ${result.errors[0].message}`);
          }
        } catch (e) {
          message.error(apiErrorMessage(e, "No se pudieron borrar los usuarios de Moodle"));
        }
      },
    });
  };

  if (!enrolments) {
    return (
      <Alert
        type="info"
        showIcon
        message="Falta el snapshot de matrículas de Moodle"
        description={
          <Space direction="vertical">
            <Text>
              Para saber qué usuarios no están en ningún curso de Moodle hay que descargar los matriculados de cada
              curso (1 llamada por curso + 1 para el catálogo). Después, todo el filtrado y el borrado por lotes
              trabajan en local.
            </Text>
            <Button type="primary" icon={<CloudDownloadOutlined />} loading={isDownloading} onClick={onDownloadEnrolments}>
              Descargar matrículas de Moodle
            </Button>
          </Space>
        }
      />
    );
  }

  const columns: ColumnsType<CleanupCandidate> = [
    { title: "Cuenta Moodle", key: "moodle", render: (_v, r) => <MoodleUserCell moodle={r.moodle} /> },
    { title: "Email", key: "email", render: (_v, r) => r.moodle.email || <Text type="secondary">—</Text> },
    { title: "Usuario local", key: "user", render: (_v, r) => <LocalUserCell user={r.linkedUser} /> },
    {
      title: "Último acceso",
      key: "lastaccess",
      width: 150,
      sorter: (a, b) => a.moodle.lastaccess - b.moodle.lastaccess,
      render: (_v, r) =>
        r.moodle.lastaccess === 0
          ? <Tag color={STATUS_COLORS.warning}>nunca</Tag>
          : formatDateTime(new Date(r.moodle.lastaccess * 1000)),
    },
    {
      title: "Protección",
      key: "protected",
      width: 160,
      render: (_v, r) =>
        r.protected ? (
          <Space size={4}>
            {r.protected_reasons.map(reason => (
              <Tag key={reason} color={STATUS_COLORS.inactive} icon={<WarningOutlined />}>
                {reason === "auth-user" ? "gestor" : "tutor"}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  return (
    <>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Usuarios de Moodle que no están matriculados en NINGÚN curso de Moodle."
        description="El borrado es en Moodle e irreversible. Los marcados como «gestor» (su email/username coincide con un usuario de acceso de AcademyHub) o «tutor» (su vínculo local tutoriza algún grupo) están protegidos y el servidor rechaza borrarlos. Moodle además rechaza admin y guest por su cuenta."
      />
      <Space style={{ marginBottom: 12 }} wrap>
        <Select<ActivityFilter> value={activity} onChange={setActivity} options={ACTIVITY_OPTIONS} style={{ width: 280 }} />
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={visibleSelected.length === 0}
          loading={isDeleting}
          onClick={() => runDelete(visibleSelected.map(Number))}
        >
          Borrar de Moodle seleccionados ({visibleSelected.length})
        </Button>
        <Text type="secondary">
          {filtered.length} de {items.length} candidatos con el filtro actual
        </Text>
      </Space>
      <Table
        size="small"
        rowKey={r => r.moodle.moodle_id}
        columns={columns}
        dataSource={filtered}
        scroll={{ x: "max-content" }}
        rowSelection={{
          selectedRowKeys: visibleSelected,
          onChange: setSelected,
          getCheckboxProps: r => ({ disabled: r.protected }),
        }}
      />
    </>
  );
};

// ---- Pestañas informativas ----
const UnverifiableTab: React.FC<{ items: UnverifiableFinding[] }> = ({ items }) => {
  const columns: ColumnsType<UnverifiableFinding> = [
    { title: "Cuenta Moodle", key: "moodle", render: (_v, r) => <MoodleUserCell moodle={r.moodle} /> },
    { title: "Usuario local vinculado", key: "linked", render: (_v, r) => <LocalUserCell user={r.linkedUser} /> },
    {
      title: "Motivo",
      dataIndex: "reason",
      key: "reason",
      width: 220,
      render: (v: UnverifiableFinding["reason"]) =>
        v === "no-dni"
          ? <Tag color={STATUS_COLORS.neutral}>Moodle no aporta DNI</Tag>
          : <Tag color={STATUS_COLORS.warning}>DNI no encontrado en la BD</Tag>,
    },
  ];
  if (items.length === 0) return <Empty description="Nada que revisar" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Vínculos que no se pueden verificar por DNI. No implican error: revísalos manualmente si sospechas de alguno."
        description="«DNI no encontrado en la BD» puede indicar que al usuario local le falta el DNI (se puede completar desde su ficha)."
      />
      <Table size="small" rowKey="id_moodle_user" columns={columns} dataSource={items} scroll={{ x: "max-content" }} />
    </>
  );
};

const NoCoursesTab: React.FC<{ items: NoCoursesFinding[] }> = ({ items }) => {
  const columns: ColumnsType<NoCoursesFinding> = [
    { title: "Cuenta Moodle", key: "moodle", render: (_v, r) => <MoodleUserCell moodle={r.moodle} /> },
    { title: "Usuario local vinculado", key: "linked", render: (_v, r) => <LocalUserCell user={r.linkedUser} /> },
    { title: "Grupos", key: "g", width: 100, render: (_v, r) => r.linkedUser.groups_count },
  ];
  if (items.length === 0) return <Empty description="Todos los vinculados tienen algún curso" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Cuentas de Moodle vinculadas cuyo usuario local no tiene ninguna matrícula en la BD."
        description="Puede que estén matriculados en cursos de Moodle que nunca se han importado: esta pantalla no consulta las matrículas de Moodle (costaría llamadas)."
      />
      <Table size="small" rowKey="id_moodle_user" columns={columns} dataSource={items} scroll={{ x: "max-content" }} />
    </>
  );
};

const UnlinkedTab: React.FC<{ items: UnlinkedFinding[] }> = ({ items }) => {
  const columns: ColumnsType<UnlinkedFinding> = [
    { title: "Cuenta Moodle", key: "moodle", render: (_v, r) => <MoodleUserCell moodle={r.moodle} /> },
    { title: "Email", key: "email", render: (_v, r) => r.moodle.email || <Text type="secondary">—</Text> },
    {
      title: "Casaría por DNI con",
      key: "match",
      render: (_v, r) =>
        r.wouldMatchUser ? <LocalUserCell user={r.wouldMatchUser} /> : <Text type="secondary">nadie (se crearía nuevo)</Text>,
    },
  ];
  if (items.length === 0) return <Empty description="La BD conoce todas las cuentas de Moodle" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Cuentas de Moodle sin vínculo en la BD. Informativo: se vincularían (o crearían) en el próximo import de sus cursos."
      />
      <Table size="small" rowKey={r => r.moodle.moodle_id} columns={columns} dataSource={items} scroll={{ x: "max-content" }} />
    </>
  );
};

// ---- Herramienta ----
const MoodleAudit: React.FC = () => {
  const { message, modal } = App.useApp();
  const { data: report, isLoading, error, refetch, isRefetching } = useMoodleAuditReportQuery();
  const { mutateAsync: refresh, isPending: isRefreshing } = useMoodleAuditRefreshMutation();
  const { mutateAsync: refreshEnrolments, isPending: isRefreshingEnrolments } = useRefreshEnrolmentsMutation();
  const { mutateAsync: syncStatus, isPending: isSyncing } = useSyncStatusMutation();

  const handleDownloadEnrolments = () => {
    modal.confirm({
      title: "Descargar matrículas de Moodle",
      content:
        "Descarga los matriculados de cada curso de Moodle (1 llamada por curso + 1 para el catálogo, cuota limitada). Con ello se calculan los usuarios sin ningún curso en Moodle. El filtrado y el borrado posteriores no gastan llamadas extra.",
      okText: "Descargar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const r = await refreshEnrolments();
          message.success(
            `Matrículas descargadas: ${r.enrolments?.courseCount ?? 0} cursos en ${r.enrolments?.moodleCalls ?? 0} llamadas · ${r.totals.cleanupCandidates} candidatos a limpieza`,
          );
        } catch (e) {
          message.error(apiErrorMessage(e, "No se pudo descargar el snapshot de matrículas"));
        }
      },
    });
  };

  const handleSyncStatus = () => {
    modal.confirm({
      title: "Sincronizar estado a la BD",
      content:
        "Escribe en la BD el estado según el snapshot descargado (0 llamadas a Moodle): copia el flag «suspendido» de cada cuenta viva y marca como «borrado en Moodle» (lápida, conservando la fila y su histórico) los vínculos cuya cuenta ya no existe.",
      okText: "Sincronizar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const r = await syncStatus();
          message.success(`Estado sincronizado: ${r.suspended_updated} flags de suspensión actualizados, ${r.deleted_marked} lápidas nuevas`);
        } catch (e) {
          message.error(apiErrorMessage(e, "No se pudo sincronizar el estado"));
        }
      },
    });
  };

  const handleDownload = () => {
    modal.confirm({
      title: "Descargar usuarios de Moodle",
      content:
        "Descarga la lista completa de usuarios de Moodle (aprox. 1 llamada + 1 por cada 200 usuarios, cuota limitada). El resto del diagnóstico y las reparaciones no hacen ninguna llamada.",
      okText: "Descargar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          const r = await refresh();
          message.success(`Snapshot descargado: ${r.snapshotSize} usuarios en ${r.moodleCallsLastFetch} llamadas a Moodle`);
        } catch (e) {
          message.error(apiErrorMessage(e, "No se pudo descargar el snapshot de Moodle"));
        }
      },
    });
  };

  if (isLoading) return <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>;
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudo cargar la auditoría de Moodle"
        description="Revisa que el backend esté actualizado y reiniciado (el endpoint /api/moodle-audit debe existir) y que tu sesión tenga permisos de administrador."
      />
    );
  }

  const r = report as MoodleAuditReport;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <PageHeader
        title="Auditoría de Moodle"
        extra={
          <>
            {r.hasSnapshot && (
              <Button icon={<ReloadOutlined />} loading={isRefetching} onClick={() => refetch()}>
                Recalcular (sin llamadas)
              </Button>
            )}
            {r.hasSnapshot && (
              <Button icon={<SyncOutlined />} loading={isSyncing} onClick={handleSyncStatus}>
                Sincronizar estado a la BD
              </Button>
            )}
            <Button type="primary" icon={<CloudDownloadOutlined />} loading={isRefreshing} onClick={handleDownload}>
              {r.hasSnapshot ? "Volver a descargar de Moodle" : "Descargar de Moodle"}
            </Button>
          </>
        }
      />
      <Card>
        {r.hasSnapshot ? (
          <Text type="secondary">
            Snapshot de <b>{r.snapshotSize}</b> usuarios de Moodle descargado el {formatDateTime(r.fetchedAt!)} (
            {r.moodleCallsLastFetch} llamadas).{" "}
            {r.enrolments
              ? `Matrículas de ${r.enrolments.courseCount} cursos descargadas el ${formatDateTime(r.enrolments.fetchedAt)} (${r.enrolments.moodleCalls} llamadas). `
              : "Matrículas de Moodle sin descargar (pestaña «Limpieza de Moodle»). "}
            Vínculos correctos: <Tag color={STATUS_COLORS.active}>{r.totals.ok}</Tag>
            El informe se recalcula contra la BD local sin gastar llamadas; los snapshots se pierden al reiniciar el servidor.
          </Text>
        ) : (
          <Alert
            type="info"
            showIcon
            message="Aún no hay datos de Moodle en memoria"
            description="Pulsa «Descargar de Moodle» para traer la lista de usuarios (una sola descarga). Después, todo el diagnóstico y las reparaciones trabajan contra la BD local sin más llamadas."
          />
        )}
      </Card>

      {r.hasSnapshot && (
        <RouteTabs
          items={[
            {
              key: "incorrectos",
              label: `Vínculos incorrectos (${r.totals.incorrectLinks})`,
              children: <IncorrectLinksTab items={r.incorrectLinks} />,
            },
            {
              key: "usernames",
              label: `Usernames desactualizados (${r.totals.usernameMismatches})`,
              children: <UsernameMismatchesTab items={r.usernameMismatches} />,
            },
            {
              key: "huerfanos",
              label: `Huérfanos (${r.totals.orphans})`,
              children: <OrphansTab items={r.orphans} />,
            },
            {
              key: "no-verificables",
              label: `No verificables (${r.totals.unverifiable})`,
              children: <UnverifiableTab items={r.unverifiable} />,
            },
            {
              key: "sin-cursos",
              label: `Sin cursos en la BD (${r.totals.noCourses})`,
              children: <NoCoursesTab items={r.noCourses} />,
            },
            {
              key: "sin-vinculo",
              label: `Sin vínculo local (${r.totals.unlinked})`,
              children: <UnlinkedTab items={r.unlinked} />,
            },
            {
              key: "limpieza",
              label: r.enrolments ? `Limpieza de Moodle (${r.totals.cleanupCandidates})` : "Limpieza de Moodle",
              children: (
                <CleanupTab
                  items={r.cleanupCandidates}
                  enrolments={r.enrolments}
                  onDownloadEnrolments={handleDownloadEnrolments}
                  isDownloading={isRefreshingEnrolments}
                />
              ),
            },
          ]}
        />
      )}
    </Space>
  );
};

export default MoodleAudit;
