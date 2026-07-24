import { useMemo, useState } from "react";
import { Button, Card, Col, Row, Segmented, Select, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { useCourseRequestsQuery } from "../../hooks/api/course-requests/use-course-requests.query";
import { useCourseRequestStatsQuery } from "../../hooks/api/course-requests/use-course-request-stats.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { CourseRequestStatus } from "../../shared/types/course-request/course-request-status.enum";
import { CourseRequest } from "../../shared/types/course-request/course-request";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { PageHeader } from "../../components/common/PageHeader";
import { RouteTabs } from "../../components/common/RouteTabs";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { formatDate } from "../../utils/format";
import { CourseRequestReportTab } from "../../components/course-requests/course-request-report-tab";

type StatusFilter = "abiertas" | "cerradas" | "todas";

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Abiertas", value: "abiertas" },
  { label: "Cerradas", value: "cerradas" },
  { label: "Todas", value: "todas" },
];

function CourseRequestsListTab() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("abiertas");
  const [idCourse, setIdCourse] = useState<number | undefined>();
  const [idCenter, setIdCenter] = useState<number | undefined>();

  const { data: courses } = useCoursesQuery();
  const { data: centers } = useCentersQuery();
  const { data: stats } = useCourseRequestStatsQuery();

  const status = statusFilter === "abiertas" ? CourseRequestStatus.ABIERTA
    : statusFilter === "cerradas" ? CourseRequestStatus.CERRADA
    : undefined;

  const { data: requests, isLoading } = useCourseRequestsQuery({ id_course: idCourse, id_center: idCenter, status });

  const columns = useMemo<ColumnsType<CourseRequest>>(() => [
    { title: "ID", dataIndex: "id_request", width: 70 },
    { title: "Curso", dataIndex: "course_name", width: 260, ellipsis: true },
    {
      title: "Centro",
      dataIndex: "center_name",
      render: (v: string | null) => v || <Tag>Sin centro</Tag>,
    },
    { title: "Empresa", dataIndex: "company_name", render: (v: string | null) => v || "-" },
    { title: "Fecha petición", dataIndex: "request_date", width: 130, render: (v: string) => formatDate(v) },
    { title: "Alumnos", dataIndex: "student_count", width: 90 },
    { title: "Contacto", dataIndex: "contact_email", render: (v: string | null) => v || <Tag color="warning">Sin correo</Tag> },
    {
      title: "Estado",
      dataIndex: "status",
      render: (v: CourseRequestStatus) => (
        <Tag color={v === CourseRequestStatus.ABIERTA ? "processing" : "default"}>{v}</Tag>
      ),
    },
    { title: "Fecha alta", dataIndex: "createdAt", render: (v: string) => formatDate(v) },
  ], []);

  const toolbar = (
    <>
      <Segmented<StatusFilter> options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      <Select
        allowClear
        showSearch
        placeholder="Filtrar por curso"
        style={{ minWidth: 220 }}
        value={idCourse}
        onChange={setIdCourse}
        optionFilterProp="label"
        options={courses?.map((c) => ({ value: c.id_course, label: c.course_name }))}
      />
      <Select
        allowClear
        showSearch
        placeholder="Filtrar por centro"
        style={{ minWidth: 220 }}
        value={idCenter}
        onChange={setIdCenter}
        optionFilterProp="label"
        options={centers?.map((c) => ({ value: c.id_center, label: c.center_name }))}
      />
      <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/course-requests/create")}>
          Nueva petición
        </Button>
      </AuthzHide>
    </>
  );

  return (
    <ListPageLayout toolbar={toolbar}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title="Por curso">
            <Table
              size="small"
              pagination={false}
              rowKey="id_course"
              dataSource={stats?.byCourse}
              columns={[
                { title: "Curso", dataIndex: "course_name" },
                { title: "Peticiones", dataIndex: "request_count", width: 100 },
                { title: "Alumnos", dataIndex: "student_count", width: 100 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Por centro / empresa">
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => `${r.id_center ?? "none"}`}
              dataSource={stats?.byCenter}
              columns={[
                { title: "Centro", dataIndex: "center_name", render: (v: string | null) => v || "Sin centro" },
                { title: "Empresa", dataIndex: "company_name", render: (v: string | null) => v || "-" },
                { title: "Peticiones", dataIndex: "request_count", width: 100 },
                { title: "Alumnos", dataIndex: "student_count", width: 100 },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <DataTable<CourseRequest>
        rowKey="id_request"
        columns={columns}
        dataSource={requests}
        loading={isLoading}
        getRowUrl={(record) => `/course-requests/${record.id_request}`}
      />
    </ListPageLayout>
  );
}

export default function CourseRequestsRoute() {
  const items = [
    { key: "peticiones", label: "Peticiones", children: <CourseRequestsListTab /> },
    { key: "informes", label: "Informes", children: <CourseRequestReportTab /> },
  ];

  return (
    <>
      <PageHeader title="Peticiones de centros" />
      <RouteTabs items={items} />
    </>
  );
}
