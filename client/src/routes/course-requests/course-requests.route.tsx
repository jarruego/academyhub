import { useMemo, useState } from "react";
import { App, Button, Card, Segmented, Select, Switch, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { useCourseRequestsQuery } from "../../hooks/api/course-requests/use-course-requests.query";
import { useCourseRequestStatsQuery } from "../../hooks/api/course-requests/use-course-request-stats.query";
import { useToggleCourseRequestUrgentMutation } from "../../hooks/api/course-requests/use-toggle-course-request-urgent.mutation";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { CourseRequestStatus } from "../../shared/types/course-request/course-request-status.enum";
import { CourseRequest } from "../../shared/types/course-request/course-request";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { PageHeader } from "../../components/common/PageHeader";
import { RouteTabs } from "../../components/common/RouteTabs";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";
import { useIsMobile } from "../../hooks/use-is-mobile";
import { formatDate } from "../../utils/format";
import { CourseRequestReportTab } from "../../components/course-requests/course-request-report-tab";

type StatusFilter = "abiertas" | "cerradas" | "todas";

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Abiertas", value: "abiertas" },
  { label: "Cerradas", value: "cerradas" },
  { label: "Todas", value: "todas" },
];

// Altura fija (~12 filas visibles con tablas de tamaño "small") en vez de
// paginación: ambos listados de esta pestaña son pequeños, se cargan enteros.
const FIXED_TABLE_HEIGHT = 480;

function CourseRequestsListTab() {
  const navigate = useNavigate();
  const role = useRole();
  const canEdit = [Role.ADMIN, Role.MANAGER].includes(role);
  const isMobile = useIsMobile();
  const { message: messageApi } = App.useApp();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("abiertas");
  const [idCourse, setIdCourse] = useState<number | undefined>();
  const [idCenter, setIdCenter] = useState<number | undefined>();
  const [idCompanies, setIdCompanies] = useState<number[]>([]);

  const { data: courses } = useCoursesQuery();
  const { data: centers } = useCentersQuery();
  const { data: companies } = useCompaniesQuery();
  const { data: stats } = useCourseRequestStatsQuery();
  const toggleUrgentMutation = useToggleCourseRequestUrgentMutation();

  const status = statusFilter === "abiertas" ? CourseRequestStatus.ABIERTA
    : statusFilter === "cerradas" ? CourseRequestStatus.CERRADA
    : undefined;

  const { data: allRequests, isLoading } = useCourseRequestsQuery({ id_course: idCourse, id_center: idCenter, status });

  // La empresa filtra en cliente (el endpoint ya devuelve id_company por fila);
  // el centro, en cambio, se filtra en servidor (ver query de arriba).
  const requests = useMemo(
    () => allRequests?.filter((r) => !idCompanies.length || (r.id_company != null && idCompanies.includes(r.id_company))),
    [allRequests, idCompanies],
  );

  // Solo centros de las empresas seleccionadas (si no hay ninguna, todos).
  const centerOptions = useMemo(
    () => centers?.filter((c) => !idCompanies.length || idCompanies.includes(c.id_company)),
    [centers, idCompanies],
  );

  const handleCompaniesChange = (values: number[]) => {
    setIdCompanies(values);
    // El centro elegido podría ya no pertenecer a las empresas seleccionadas.
    setIdCenter(undefined);
  };

  const handleToggleUrgent = async (record: CourseRequest, checked: boolean) => {
    try {
      await toggleUrgentMutation.mutateAsync({ id_request: record.id_request, is_urgent: checked });
    } catch {
      messageApi.error("No se pudo actualizar (¿la petición está cerrada?)");
    }
  };

  const columns = useMemo<ColumnsType<CourseRequest>>(() => [
    {
      title: "Urgente",
      dataIndex: "is_urgent",
      width: 80,
      sorter: (a, b) => Number(a.is_urgent) - Number(b.is_urgent),
      render: (v: boolean, record) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            size="small"
            checked={v}
            disabled={!canEdit}
            onChange={(checked) => handleToggleUrgent(record, checked)}
          />
        </span>
      ),
    },
    {
      title: "ID",
      dataIndex: "id_request",
      width: 60,
      sorter: (a, b) => a.id_request - b.id_request,
    },
    {
      title: "Curso",
      dataIndex: "course_name",
      ellipsis: true,
      sorter: (a, b) => a.course_name.localeCompare(b.course_name),
    },
    {
      title: "Centro",
      dataIndex: "center_name",
      width: 140,
      ellipsis: true,
      sorter: (a, b) => (a.center_name ?? "").localeCompare(b.center_name ?? ""),
      render: (v: string | null) => v || <Tag>Sin centro</Tag>,
    },
    {
      title: "Empresa",
      dataIndex: "company_name",
      ellipsis: true,
      sorter: (a, b) => (a.company_name ?? "").localeCompare(b.company_name ?? ""),
      render: (v: string | null) => v || "-",
    },
    {
      title: "Fecha petición",
      dataIndex: "request_date",
      width: 120,
      sorter: (a, b) => new Date(a.request_date).getTime() - new Date(b.request_date).getTime(),
      render: (v: string) => formatDate(v),
    },
    {
      title: "Alumnos",
      dataIndex: "student_count",
      width: 50,
      ellipsis: true,
      sorter: (a, b) => a.student_count - b.student_count,
    },
    {
      title: "Estado",
      dataIndex: "status",
      width: 100,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: CourseRequestStatus) => (
        <Tag color={v === CourseRequestStatus.ABIERTA ? "processing" : "default"}>{v}</Tag>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canEdit]);

  // Empresas con alguna petición, para las columnas dinámicas del pivote "Por curso"
  // (ordenadas por nombre, para que las columnas no bailen entre recargas).
  const companyColumns = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of stats?.byCourseCompany ?? []) map.set(row.id_company, row.company_name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [stats]);

  // Curso x Empresa -> { alumnos, peticiones }, para rellenar las celdas del pivote.
  const statsByCourseCompanyKey = useMemo(() => {
    const map = new Map<string, { request_count: number; student_count: number }>();
    for (const row of stats?.byCourseCompany ?? []) {
      map.set(`${row.id_course}-${row.id_company}`, {
        request_count: row.request_count,
        student_count: row.student_count,
      });
    }
    return map;
  }, [stats]);

  const byCourseColumns = useMemo<ColumnsType<Record<string, unknown>>>(() => [
    {
      title: "Curso",
      dataIndex: "course_name",
      width: 200,
      ellipsis: true,
      sorter: (a, b) => String(a.course_name).localeCompare(String(b.course_name)),
    },
    {
      title: "Peticiones",
      dataIndex: "request_count",
      width: 50,
      ellipsis: true,
      sorter: (a, b) => Number(a.request_count) - Number(b.request_count),
    },
    {
      title: "Alumnos",
      dataIndex: "student_count",
      width: 50,
      ellipsis: true,
      sorter: (a, b) => Number(a.student_count) - Number(b.student_count),
    },
    ...companyColumns.map(([id_company, company_name]) => ({
      title: company_name,
      key: `company_${id_company}`,
      width: 65,
      ellipsis: true,
      sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => {
        const av = statsByCourseCompanyKey.get(`${a.id_course}-${id_company}`)?.student_count ?? 0;
        const bv = statsByCourseCompanyKey.get(`${b.id_course}-${id_company}`)?.student_count ?? 0;
        return av - bv;
      },
      render: (_: unknown, record: Record<string, unknown>) => {
        const cell = statsByCourseCompanyKey.get(`${record.id_course}-${id_company}`);
        if (!cell || cell.student_count === 0) return <span style={{ opacity: 0.4 }}>-</span>;
        return `${cell.student_count} (${cell.request_count})`;
      },
    })),
  ], [companyColumns, statsByCourseCompanyKey]);

  const toolbar = (
    <>
      <Segmented<StatusFilter> options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      <Select
        mode="multiple"
        allowClear
        showSearch
        maxTagCount="responsive"
        placeholder="Filtrar por empresa (varias a la vez)"
        style={{ minWidth: 220 }}
        value={idCompanies}
        onChange={handleCompaniesChange}
        optionFilterProp="label"
        options={companies?.map((c) => ({ value: c.id_company, label: c.company_name }))}
      />
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
        options={centerOptions?.map((c) => ({ value: c.id_center, label: c.center_name }))}
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
      <Card
        size="small"
        title="Por curso"
        style={{ marginBottom: 16 }}
        extra={<span style={{ fontSize: 12, opacity: 0.6 }}>Columnas de empresa: alumnos (peticiones)</span>}
      >
        <Table
          size="small"
          tableLayout={isMobile ? undefined : "fixed"}
          pagination={false}
          sortDirections={["ascend", "descend"]}
          rowKey="id_course"
          dataSource={stats?.byCourse}
          columns={byCourseColumns}
          scroll={{ y: FIXED_TABLE_HEIGHT, x: isMobile ? "max-content" : undefined }}
        />
      </Card>
      <DataTable<CourseRequest>
        size="small"
        tableLayout={isMobile ? undefined : "fixed"}
        rowKey="id_request"
        columns={columns}
        dataSource={requests}
        loading={isLoading}
        getRowUrl={(record) => `/course-requests/${record.id_request}`}
        rowClassName={(record) => (record.is_urgent ? "course-request-urgent-row" : "")}
        pagination={false}
        scroll={{ y: FIXED_TABLE_HEIGHT, x: isMobile ? "max-content" : undefined }}
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
