import React from "react";
import { Tag, Spin, Empty, Button, Popconfirm, App } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { DataTable } from "../common/DataTable";
import {
  useCoursePreinscriptionsQuery,
  useCourseEnrolledCountQuery,
  useDeleteCoursePreinscriptionsMutation,
  CoursePreinscription,
} from "../../hooks/api/import-inaem/useInaemData";
import { useRole } from "../../utils/permissions/use-role";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const STATUS_COLOR: Record<CoursePreinscription["status"], string> = {
  PREINSCRITO: "blue",
  MATRICULADO: "green",
  DESCARTADO: "default",
  BAJA: "red",
};

const fullName = (r: CoursePreinscription) =>
  [r.name, r.first_surname, r.second_surname].filter(Boolean).join(" ").trim();

interface Props {
  courseId: number;
}

export const CoursePreinscriptionsSection: React.FC<Props> = ({ courseId }) => {
  const { message } = App.useApp();
  const role = useRole();
  const isAdmin = role === Role.ADMIN;
  const { data, isLoading } = useCoursePreinscriptionsQuery(courseId);
  // El conteo de matriculados solo lo necesita el botón de borrado (ADMIN).
  const { data: enrolledCount } = useCourseEnrolledCountQuery(courseId, isAdmin);
  const { mutateAsync: deleteAll, isPending: isDeleting } = useDeleteCoursePreinscriptionsMutation(courseId);

  // El botón solo aparece para ADMIN y cuando el curso no tiene a nadie matriculado.
  const canDeleteAll = isAdmin && enrolledCount === 0;

  const handleDeleteAll = async () => {
    try {
      const { deleted } = await deleteAll();
      message.success(`Se han borrado ${deleted} preinscripción(es).`);
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(apiMessage || "No se pudieron borrar las preinscripciones.");
    }
  };

  const columns: ColumnsType<CoursePreinscription> = [
    {
      title: "Alumno",
      key: "name",
      render: (_: unknown, record: CoursePreinscription) => <strong>{fullName(record) || "-"}</strong>,
      sorter: (a, b) => fullName(a).localeCompare(fullName(b)),
    },
    {
      title: "DNI",
      dataIndex: "dni",
      key: "dni",
      render: (v: string | null) => v || "-",
    },
    {
      title: "Estado",
      dataIndex: "status",
      key: "status",
      render: (status: CoursePreinscription["status"]) => <Tag color={STATUS_COLOR[status]}>{status}</Tag>,
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
    <div>
      {canDeleteAll && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Popconfirm
            title="Borrar todas las preinscripciones"
            description="Se eliminarán todas las preinscripciones de este curso. Esta acción no se puede deshacer."
            okText="Borrar todas"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={handleDeleteAll}
          >
            <Button danger icon={<DeleteOutlined />} loading={isDeleting}>
              Borrar todas las preinscripciones
            </Button>
          </Popconfirm>
        </div>
      )}
      <DataTable<CoursePreinscription>
        columns={columns}
        dataSource={data}
        rowKey={(r) => `${courseId}-${r.id_user}`}
        pagination={false}
        getRowUrl={(record) => `/users/${record.id_user}`}
      />
    </div>
  );
};
