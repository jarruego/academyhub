import React, { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Card, Checkbox, Empty, Modal, Radio, Space, Spin, Table, Tag, Typography } from "antd";
import { STATUS_COLORS } from "../../theme/semantic-colors";
import { MergeCellsOutlined, SwapOutlined, WarningOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { PageHeader } from "../common/PageHeader";
import {
  MergeCandidateGroup,
  MergeCandidateMember,
  useMergeCandidatesQuery,
  useMergeMutation,
  useMergePreviewQuery,
} from "../../hooks/api/user-merge/useMergeData";

const { Text, Title } = Typography;

const fullName = (m: { name: string; first_surname: string | null; second_surname: string | null }) =>
  [m.name, m.first_surname, m.second_surname].filter(Boolean).join(" ").trim();

const showValue = (v: unknown) => {
  if (v === null || v === undefined || v === "") return <Text type="secondary">(vacío)</Text>;
  return <Text>{String(v)}</Text>;
};

// ---- Modal de previsualización + confirmación de una fusión concreta ----
// Exportado: lo reutiliza la Auditoría de Moodle para fusionar vínculos incorrectos.
export const MergeModal: React.FC<{
  winnerId: number;
  loserId: number;
  onClose: () => void;
}> = ({ winnerId: initialWinnerId, loserId: initialLoserId, onClose }) => {
  const { message } = App.useApp();
  // Los props son el punto de partida: el botón "Intercambiar" permite invertir
  // ganador y perdedor sin cerrar el modal (la previsualización se recarga).
  const [ids, setIds] = useState({ winnerId: initialWinnerId, loserId: initialLoserId });
  const { winnerId, loserId } = ids;
  const { data: preview, isLoading } = useMergePreviewQuery(winnerId, loserId);
  const { mutateAsync: merge, isPending } = useMergeMutation();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Por defecto se traen del perdedor solo los campos donde el ganador está vacío.
  useEffect(() => {
    if (preview) {
      setChecked(new Set(preview.fields.filter(f => f.differ && f.winnerEmpty).map(f => f.field)));
    }
  }, [preview]);

  const conflictFields = useMemo(() => preview?.fields.filter(f => f.differ) ?? [], [preview]);

  const toggle = (field: string, on: boolean) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (on) next.add(field); else next.delete(field);
      return next;
    });
  };

  const handleConfirm = async () => {
    try {
      await merge({ winnerId, loserId, fieldsFromLoser: Array.from(checked) });
      message.success("Usuarios fusionados correctamente");
      onClose();
    } catch (e) {
      const maybe = e as { response?: { data?: { message?: string } } } | undefined;
      message.error(maybe?.response?.data?.message || "No se pudo fusionar");
    }
  };

  const columns: ColumnsType<{ field: string; winnerValue: unknown; loserValue: unknown }> = [
    { title: "Campo", dataIndex: "field", key: "field", width: 180 },
    { title: "Ganador (se conserva)", key: "w", render: (_v, r) => showValue(r.winnerValue) },
    { title: "Perdedor", key: "l", render: (_v, r) => showValue(r.loserValue) },
    {
      title: "Traer del perdedor",
      key: "take",
      width: 140,
      align: "center",
      render: (_v, r) => (
        <Checkbox checked={checked.has(r.field)} onChange={e => toggle(r.field, e.target.checked)} />
      ),
    },
  ];

  return (
    <Modal
      open
      title="Fusionar usuarios"
      width={820}
      onCancel={onClose}
      footer={[
        <Button
          key="swap"
          icon={<SwapOutlined />}
          disabled={isLoading || isPending}
          onClick={() => setIds(({ winnerId, loserId }) => ({ winnerId: loserId, loserId: winnerId }))}
        >
          Intercambiar ganador ↔ perdedor
        </Button>,
        <Button key="cancel" onClick={onClose}>Cancelar</Button>,
        <Button key="ok" type="primary" danger loading={isPending} onClick={handleConfirm} disabled={isLoading || !preview}>
          Fusionar y borrar al perdedor
        </Button>,
      ]}
    >
      {isLoading || !preview ? (
        <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message={
              <span>
                Ganador <Tag color={STATUS_COLORS.active}>#{preview.winner.id_user}</Tag> {fullName(preview.winner)} ·
                Perdedor <Tag color={STATUS_COLORS.inactive}>#{preview.loser.id_user}</Tag> {fullName(preview.loser)}
              </span>
            }
            description="Todas las matrículas, grupos, centros y preinscripciones del perdedor pasan al ganador. El perdedor se elimina (irreversible)."
          />

          {preview.dualMoodle && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message="Ambas fichas tienen cuenta de Moodle"
              description="Ambos mapeos Moodle quedarán bajo el ganador (una sola cuenta principal). La fusión NO toca Moodle: revisa/limpia las cuentas en Moodle si es necesario."
            />
          )}

          <Alert
            type={preview.resolvedNss.valid ? "success" : "warning"}
            showIcon
            message={
              <span>
                NSS que se conservará: <Tag color={preview.resolvedNss.valid ? STATUS_COLORS.active : STATUS_COLORS.warning}>{preview.resolvedNss.value ?? "(ninguno)"}</Tag>
                {preview.resolvedNss.valid ? " (dígito de control válido)" : " (ningún NSS válido; se guarda en forma de 12 dígitos)"}
              </span>
            }
            description={
              preview.resolvedNss.winnerNss !== preview.resolvedNss.loserNss
                ? `Ganador: ${preview.resolvedNss.winnerNss ?? "(vacío)"} · Perdedor: ${preview.resolvedNss.loserNss ?? "(vacío)"}. El NSS se resuelve automáticamente (no por el selector): se conserva el válido, sea de quien sea.`
                : undefined
            }
          />

          {(preview.collisions.courses + preview.collisions.groups + preview.collisions.centers + preview.collisions.preinscriptions) > 0 && (
            <Text type="secondary">
              Relaciones compartidas que se fusionarán: {preview.collisions.courses} cursos, {preview.collisions.groups} grupos,
              {" "}{preview.collisions.centers} centros, {preview.collisions.preinscriptions} preinscripciones.
            </Text>
          )}

          <div>
            <Title level={5} style={{ marginBottom: 8 }}>Campos en conflicto</Title>
            {conflictFields.length === 0 ? (
              <Text type="secondary">No hay campos en conflicto. El ganador conserva todos sus datos.</Text>
            ) : (
              <Table
                size="small"
                rowKey="field"
                columns={columns}
                dataSource={conflictFields}
                pagination={false}
              />
            )}
          </div>
        </Space>
      )}
    </Modal>
  );
};

// ---- Tabla de un grupo de duplicados (mismo NSS normalizado) ----
const CandidateGroup: React.FC<{ group: MergeCandidateGroup }> = ({ group }) => {
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ winnerId: number; loserId: number } | null>(null);

  const columns: ColumnsType<MergeCandidateMember> = [
    {
      title: "Ganador",
      key: "winner",
      width: 80,
      align: "center",
      render: (_v, r) => (
        <Radio checked={winnerId === r.id_user} onChange={() => setWinnerId(r.id_user)} />
      ),
    },
    { title: "ID", dataIndex: "id_user", key: "id_user", width: 80 },
    { title: "Nombre", key: "name", render: (_v, r) => fullName(r) },
    { title: "DNI/NIE", dataIndex: "dni", key: "dni" },
    { title: "NSS", dataIndex: "nss", key: "nss" },
    { title: "Email", key: "email", render: (_v, r) => (r.email ? r.email : <Text type="secondary">—</Text>) },
    {
      title: "Relaciones",
      key: "rel",
      render: (_v, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.courses_count}c · {r.groups_count}g · {r.centers_count}ce · {r.preinscriptions_count}p · {r.moodle_count}m
        </Text>
      ),
    },
    {
      title: "Acción",
      key: "action",
      width: 150,
      render: (_v, r) => (
        <Button
          size="small"
          icon={<MergeCellsOutlined />}
          disabled={winnerId === null || winnerId === r.id_user}
          onClick={() => setMergeTarget({ winnerId: winnerId!, loserId: r.id_user })}
        >
          Fusionar →
        </Button>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={<span>NSS <Tag>{group.nss_norm}</Tag> · {group.members.length} fichas</span>}
      extra={!group.nameMatch && (
        <Tag color={STATUS_COLORS.warning} icon={<WarningOutlined />}>Nombres no coinciden — revisar</Tag>
      )}
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        Elige el <b>ganador</b> (la ficha que se conserva) y pulsa "Fusionar →" en la que quieras absorber.
      </Text>
      <Table
        style={{ marginTop: 8 }}
        size="small"
        rowKey="id_user"
        columns={columns}
        dataSource={group.members}
        pagination={false}
      />
      {mergeTarget && (
        <MergeModal
          winnerId={mergeTarget.winnerId}
          loserId={mergeTarget.loserId}
          onClose={() => setMergeTarget(null)}
        />
      )}
    </Card>
  );
};

const MergeDuplicates: React.FC = () => {
  const { data, isLoading, error } = useMergeCandidatesQuery();

  if (isLoading) return <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>;
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="No se pudo cargar la detección de duplicados"
        description="Revisa que el backend esté actualizado y reiniciado (el endpoint /api/user-merge debe existir) y que tu sesión tenga permisos de administrador."
      />
    );
  }
  if (!data || data.length === 0) {
    return <Empty description="No se han detectado duplicados por NSS" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <PageHeader
        title="Fusión de duplicados"
        subtitle="Grupos de fichas que comparten el mismo NSS normalizado (sin ceros a la izquierda ni separadores). Suelen ser la misma persona con NIE y DNI distintos. La leyenda de relaciones es: cursos · grupos · centros · preinscripciones · cuentas Moodle."
      />
      {data.map(group => (
        <CandidateGroup key={group.nss_norm} group={group} />
      ))}
    </Space>
  );
};

export default MergeDuplicates;
