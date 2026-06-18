import React from "react";
import { Table, Tag, Spin, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useUserPreinscriptionsQuery, UserPreinscription } from "../../hooks/api/import-inaem/useInaemData";

const STATUS_COLOR: Record<UserPreinscription["status"], string> = {
  PREINSCRITO: "blue",
  MATRICULADO: "green",
  DESCARTADO: "default",
  BAJA: "red",
};

interface Props {
  userId: number;
}

export const UserPreinscriptionsSection: React.FC<Props> = ({ userId }) => {
  const { data, isLoading } = useUserPreinscriptionsQuery(userId);

  const columns: ColumnsType<UserPreinscription> = [
    {
      title: "Curso",
      dataIndex: "course_name",
      key: "course_name",
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: "Nº Expediente",
      dataIndex: "file_number",
      key: "file_number",
      render: (v: string | null) => v || "-",
    },
    {
      title: "Estado",
      dataIndex: "status",
      key: "status",
      render: (status: UserPreinscription["status"], record: UserPreinscription) => (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Tag color={STATUS_COLOR[status]}>{status}</Tag>
          {/* Finalizado: solo si está matriculado y hay dato de finalización */}
          {status === "MATRICULADO" && record.finalized !== null && (
            <Tag color={record.finalized ? "green" : "red"}>
              {record.finalized ? "Finalizado" : "No finalizado"}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: "Prioritaria",
      dataIndex: "prioritaria",
      key: "prioritaria",
      render: (p: boolean) => (p ? <Tag color="gold">Prioritaria</Tag> : "-"),
    },
    {
      title: "Fecha",
      dataIndex: "preinscription_date",
      key: "preinscription_date",
      render: (d: string | null) => (d ? dayjs(d).format("DD/MM/YYYY") : "-"),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <Empty description="Sin preinscripciones" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey={(r) => `${userId}-${r.id_course}`}
      pagination={false}
      scroll={{ x: "max-content" }}
      onRow={(record) => ({
        onDoubleClick: () => window.open(`${window.location.origin}/courses/${record.id_course}`, "_blank", "noopener,noreferrer"),
        style: { cursor: "pointer" },
      })}
    />
  );
};
