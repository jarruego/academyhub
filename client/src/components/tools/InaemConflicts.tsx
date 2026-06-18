import React from "react";
import { Table, Button, Tag, Space, Empty, Typography, App } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useInaemConflictsQuery, useResolveInaemConflictMutation, InaemConflict } from "../../hooks/api/import-inaem/useInaemData";

const { Text } = Typography;

const InaemConflicts: React.FC = () => {
  const { message } = App.useApp();
  const { data, isLoading } = useInaemConflictsQuery();
  const { mutateAsync: resolve, isPending } = useResolveInaemConflictMutation();

  const handle = async (id: number, action: "overwrite" | "keep") => {
    try {
      await resolve({ id, action });
      message.success(action === "overwrite" ? "Datos sobrescritos" : "Se mantienen los datos actuales");
    } catch {
      message.error("No se pudo resolver el conflicto");
    }
  };

  const columns: ColumnsType<InaemConflict> = [
    {
      title: "Usuario en BD",
      key: "user",
      render: (_v, r) => (
        <div>
          <div><strong>{[r.name_db, r.first_surname_db, r.second_surname_db].filter(Boolean).join(" ")}</strong></div>
          <Text type="secondary">{r.dni_db}</Text>
        </div>
      ),
    },
    {
      title: "Origen",
      dataIndex: "import_source",
      key: "import_source",
      render: (s: string) => <Tag>{s?.replace("inaem-", "")}</Tag>,
    },
    {
      title: "Campos en conflicto (BD → INAEM)",
      key: "conflicts",
      render: (_v, r) => {
        const conflicts = r.change_metadata?.conflicts ?? [];
        if (!conflicts.length) return "-";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {conflicts.map((c) => (
              <div key={c.field}>
                <Tag color="default">{c.field}</Tag>
                <Text delete type="secondary">{c.dbValue || "(vacío)"}</Text>
                {" → "}
                <Text strong>{c.incomingValue || "(vacío)"}</Text>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: "Acción",
      key: "action",
      render: (_v, r) => (
        <Space>
          <Button danger size="small" loading={isPending} onClick={() => handle(r.id, "overwrite")}>
            Sobrescribir
          </Button>
          <Button size="small" loading={isPending} onClick={() => handle(r.id, "keep")}>
            Mantener
          </Button>
        </Space>
      ),
    },
  ];

  if (!isLoading && (!data || data.length === 0)) {
    return <Empty description="No hay conflictos pendientes" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={isLoading}
      pagination={{ pageSize: 20 }}
      scroll={{ x: "max-content" }}
    />
  );
};

export default InaemConflicts;
