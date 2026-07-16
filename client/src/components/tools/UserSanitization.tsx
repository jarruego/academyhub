import React, { useMemo, useState } from "react";
import { Alert, App, Button, Empty, Input, Modal, Popconfirm, Select, Space, Spin, Switch, Table, Tag, Typography } from "antd";
import { ArrowRightOutlined, ExportOutlined, SaveOutlined, ThunderboltOutlined, ToolOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { PageHeader } from "../common/PageHeader";
import {
  AutoFixableField,
  SanitizableField,
  UserIssue,
  UserWithIssues,
  useFixAllMutation,
  useFixIssueMutation,
  useManualFixMutation,
  useSanitizationIssuesQuery,
} from "../../hooks/api/user-sanitization/useSanitization";
import { FLAG_COLORS } from "../../theme/semantic-colors";

const { Text } = Typography;

type FieldKey = UserIssue["field"];

const FIELD_META: Record<FieldKey, { label: string; color: string }> = {
  phone: { label: "Teléfono", color: "blue" },
  email: { label: "Email", color: "geekblue" },
  dni: { label: "DNI/NIE", color: "volcano" },
  nss: { label: "NSS", color: "magenta" },
};

const AUTO_FIXABLE_FIELDS: AutoFixableField[] = ["phone", "email", "nss"];

const fullName = (u: { name: string; first_surname: string | null; second_surname: string | null }) =>
  [u.name, u.first_surname, u.second_surname].filter(Boolean).join(" ").trim();

const openUserTab = (id: number) => window.open(`/users/${id}`, "_blank", "noopener");

// ---- Barra de corrección masiva (un botón por campo auto-corregible) ----
const BulkFixBar: React.FC<{ counts: Record<AutoFixableField, number> }> = ({ counts }) => {
  const { message } = App.useApp();
  const { mutateAsync: fixAll, isPending } = useFixAllMutation();
  const [pendingField, setPendingField] = useState<AutoFixableField | null>(null);

  const handleFixAll = async (field: AutoFixableField) => {
    setPendingField(field);
    try {
      const res = await fixAll({ field });
      if (res.failed.length > 0) {
        message.warning(
          `${res.fixed} ${FIELD_META[field].label.toLowerCase()} corregidos; ${res.failed.length} no se pudieron (valor duplicado, revísalos a mano).`,
        );
      } else {
        message.success(`${res.fixed} ${FIELD_META[field].label.toLowerCase()} corregidos`);
      }
    } catch {
      message.error("No se pudo completar la corrección masiva");
    } finally {
      setPendingField(null);
    }
  };

  return (
    <Space wrap>
      <Text strong>Corrección masiva:</Text>
      {AUTO_FIXABLE_FIELDS.map(field => (
        <Popconfirm
          key={field}
          title={`Corregir ${counts[field]} ${FIELD_META[field].label.toLowerCase()}`}
          description="Se aplicará el valor saneado a todos los registros auto-corregibles. Acción no reversible."
          okText="Corregir todos"
          cancelText="Cancelar"
          disabled={counts[field] === 0}
          onConfirm={() => handleFixAll(field)}
        >
          <Button
            icon={<ThunderboltOutlined />}
            disabled={counts[field] === 0}
            loading={isPending && pendingField === field}
          >
            {FIELD_META[field].label} ({counts[field]})
          </Button>
        </Popconfirm>
      ))}
    </Space>
  );
};

// ---- Modal de corrección / apertura de ficha de un error concreto ----
const FixModal: React.FC<{
  user: UserWithIssues;
  issue: UserIssue;
  onClose: () => void;
}> = ({ user, issue, onClose }) => {
  const { message } = App.useApp();
  const { mutateAsync: fix, isPending: isFixing } = useFixIssueMutation();
  const { mutateAsync: manualFix, isPending: isSaving } = useManualFixMutation();
  const [manualValue, setManualValue] = useState(issue.value);
  const meta = FIELD_META[issue.field];

  const errorMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

  const handleFix = async () => {
    try {
      await fix({ id: user.id_user, field: issue.field as AutoFixableField });
      message.success(`${meta.label} corregido`);
      onClose();
    } catch (e) {
      message.error(errorMsg(e, "No se pudo corregir"));
    }
  };

  const handleManualSave = async () => {
    try {
      await manualFix({ id: user.id_user, field: issue.field as SanitizableField, value: manualValue });
      message.success(`${meta.label} actualizado`);
      onClose();
    } catch (e) {
      message.error(errorMsg(e, "No se pudo guardar (revisa que el valor sea válido)"));
    }
  };

  return (
    <Modal
      open
      title={<span><Tag color={meta.color}>{meta.label}</Tag> de {fullName(user)}</span>}
      onCancel={onClose}
      footer={[
        <Button key="open" icon={<ExportOutlined />} onClick={() => openUserTab(user.id_user)}>
          Abrir ficha
        </Button>,
        issue.fixable ? (
          <Button key="fix" type="primary" icon={<ToolOutlined />} loading={isFixing} onClick={handleFix}>
            Aplicar corrección
          </Button>
        ) : (
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={isSaving}
            disabled={manualValue.trim() === "" || manualValue.trim() === issue.value}
            onClick={handleManualSave}
          >
            Guardar valor
          </Button>
        ),
      ]}
    >
      {issue.fixable ? (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Corrección automática disponible"
            description="Se aplicará el valor saneado mostrado abajo. La validación se realiza en el servidor."
          />
          <div style={{ fontSize: 16 }}>
            <Text delete type="danger">{issue.value}</Text>
            <ArrowRightOutlined style={{ margin: "0 12px" }} />
            <Text strong type="success">{issue.suggestion}</Text>
          </div>
        </Space>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="No se puede corregir automáticamente"
            description={
              <span>
                El valor <Text code>{issue.value}</Text> no es válido y no admite un saneo seguro
                (p. ej. dígito de control erróneo o datos incompletos). Corrígelo a mano abajo
                (se validará al guardar) o ábrelo en la ficha del usuario.
              </span>
            }
          />
          <div>
            <Text type="secondary">Nuevo valor de {meta.label.toLowerCase()}:</Text>
            <Input
              value={manualValue}
              onChange={e => setManualValue(e.target.value)}
              onPressEnter={handleManualSave}
              placeholder={`Introduce un ${meta.label.toLowerCase()} válido`}
              style={{ marginTop: 4 }}
            />
          </div>
        </Space>
      )}
    </Modal>
  );
};

const UserSanitization: React.FC = () => {
  const { data, isLoading, error } = useSanitizationIssuesQuery();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FieldKey | "all">("all");
  const [hideBajas, setHideBajas] = useState(false);
  const [selected, setSelected] = useState<{ user: UserWithIssues; issue: UserIssue } | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data
      .map(u => ({
        ...u,
        issues: typeFilter === "all" ? u.issues : u.issues.filter(i => i.field === typeFilter),
      }))
      .filter(u => u.issues.length > 0)
      .filter(u => (hideBajas ? !u.baja : true))
      .filter(u => (term ? fullName(u).toLowerCase().includes(term) || String(u.id_user).includes(term) : true));
  }, [data, search, typeFilter, hideBajas]);

  const totalIssues = useMemo(
    () => (data ?? []).reduce((acc, u) => acc + u.issues.length, 0),
    [data],
  );

  // Nº de valores auto-corregibles por campo (sobre el total, no el filtrado).
  const autoFixCounts = useMemo(() => {
    const counts: Record<AutoFixableField, number> = { phone: 0, email: 0, nss: 0 };
    for (const u of data ?? []) {
      for (const issue of u.issues) {
        if (issue.fixable && issue.field !== "dni") counts[issue.field] += 1;
      }
    }
    return counts;
  }, [data]);

  if (isLoading) return <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>;
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudo cargar la sanitización de datos"
        description="Revisa que el backend esté actualizado y reiniciado (el endpoint /api/user-sanitization debe existir) y que tu sesión tenga permisos de administrador."
      />
    );
  }

  const columns: ColumnsType<UserWithIssues> = [
    { title: "ID", dataIndex: "id_user", key: "id_user", width: 80 },
    {
      title: "Nombre",
      key: "name",
      render: (_v, r) => (
        <span>
          {fullName(r)}
          {r.baja && (
            <Tag color={FLAG_COLORS.baja} style={{ marginInlineStart: 6 }}>
              Baja
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: "Errores detectados",
      key: "issues",
      render: (_v, r) => (
        <Space size={[4, 4]} wrap>
          {r.issues.map(issue => (
            <Tag
              key={issue.field}
              color={FIELD_META[issue.field].color}
              style={{ cursor: "pointer" }}
              onClick={() => setSelected({ user: r, issue })}
            >
              {FIELD_META[issue.field].label}: {issue.value}
              {issue.fixable ? " ✎" : " ⚠"}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Acción",
      key: "action",
      width: 120,
      render: (_v, r) => (
        <Button size="small" icon={<ExportOutlined />} onClick={() => openUserTab(r.id_user)}>
          Ficha
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <PageHeader
        title="Sanitización de datos"
        subtitle={
          <>
            Usuarios con un valor <b>presente pero inválido</b> en teléfono, email, DNI/NIE o NSS.
            Haz clic en una etiqueta de error: <Tag>✎</Tag> permite corregirlo automáticamente y
            {" "}<Tag>⚠</Tag> requiere edición manual (abre la ficha en otra pestaña).
          </>
        }
      />

      <BulkFixBar counts={autoFixCounts} />

      <Space wrap>
        <Select<FieldKey | "all">
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 180 }}
          options={[
            { value: "all", label: "Todos los tipos" },
            ...(Object.keys(FIELD_META) as FieldKey[]).map(f => ({ value: f, label: FIELD_META[f].label })),
          ]}
        />
        <Input.Search
          placeholder="Buscar por nombre o ID"
          allowClear
          style={{ width: 260 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Space>
          <Switch checked={hideBajas} onChange={setHideBajas} />
          <Text>Ocultar bajas</Text>
        </Space>
        <Text type="secondary">
          {filtered.length} usuarios · {totalIssues} errores en total
        </Text>
      </Space>

      {filtered.length === 0 ? (
        <Empty description="No hay errores que mostrar" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Table
          size="small"
          rowKey="id_user"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      )}

      {selected && (
        <FixModal user={selected.user} issue={selected.issue} onClose={() => setSelected(null)} />
      )}
    </Space>
  );
};

export default UserSanitization;
