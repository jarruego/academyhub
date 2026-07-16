import React, { useState } from "react";
import { Alert, App, Button, Card, Empty, Space, Spin, Table, Tag, Typography } from "antd";
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
  IncorrectLinkFinding,
  MoodleAuditReport,
  NoCoursesFinding,
  OrphanFinding,
  UnlinkedFinding,
  UnverifiableFinding,
  UsernameMismatchFinding,
  useFixUsernamesMutation,
  useMoodleAuditRefreshMutation,
  useMoodleAuditReportQuery,
  useOrphanCleanupMutation,
  useRelinkMutation,
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
    { title: "Username Moodle", dataIndex: "moodle_username", key: "u" },
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
            {r.moodleCallsLastFetch} llamadas). Vínculos correctos: <Tag color={STATUS_COLORS.active}>{r.totals.ok}</Tag>
            El informe se recalcula contra la BD local sin gastar llamadas; el snapshot se pierde al reiniciar el servidor.
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
          ]}
        />
      )}
    </Space>
  );
};

export default MoodleAudit;
