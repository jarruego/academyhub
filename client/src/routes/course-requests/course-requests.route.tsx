import { useMemo, useState } from "react";
import { App, Button, Card, Segmented, Select, Switch, Table, Tag, Tooltip, Typography } from "antd";
import { CopyOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { useCourseRequestsQuery } from "../../hooks/api/course-requests/use-course-requests.query";
import { useToggleCourseRequestUrgentMutation } from "../../hooks/api/course-requests/use-toggle-course-request-urgent.mutation";
import { useDuplicateCourseRequestMutation } from "../../hooks/api/course-requests/use-duplicate-course-request.mutation";
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
import { openDetail } from "../../utils/open-detail";
import { formatDate } from "../../utils/format";
import { CourseRequestReportTab } from "../../components/course-requests/course-request-report-tab";

type StatusFilter = "abiertas" | "cerradas" | "todas";

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Abiertas", value: "abiertas" },
  { label: "Cerradas", value: "cerradas" },
  { label: "Todas", value: "todas" },
];

// Altura fija (10 filas visibles con tablas de tamaño "small") en vez de
// paginación: ambos listados de esta pestaña son pequeños, se cargan enteros.
const FIXED_TABLE_HEIGHT = 400;

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
  const [idGroup, setIdGroup] = useState<number | undefined>();

  const { data: courses } = useCoursesQuery();
  const { data: centers } = useCentersQuery();
  const { data: companies } = useCompaniesQuery();
  const toggleUrgentMutation = useToggleCourseRequestUrgentMutation();
  const duplicateMutation = useDuplicateCourseRequestMutation();

  const status = statusFilter === "abiertas" ? CourseRequestStatus.ABIERTA
    : statusFilter === "cerradas" ? CourseRequestStatus.CERRADA
    : undefined;

  const { data: allRequests, isLoading } = useCourseRequestsQuery({ id_course: idCourse, id_center: idCenter, status });

  // La empresa y el grupo filtran en cliente (el endpoint ya devuelve
  // id_company y groups por fila); el centro y el curso, en cambio, se
  // filtran en servidor (ver query de arriba).
  const companyFilteredRequests = useMemo(
    () => allRequests?.filter((r) => !idCompanies.length || (r.id_company != null && idCompanies.includes(r.id_company))),
    [allRequests, idCompanies],
  );

  const requests = useMemo(
    () => companyFilteredRequests?.filter((r) => !idGroup || r.groups.some((g) => g.id_group === idGroup)),
    [companyFilteredRequests, idGroup],
  );

  // Solo centros de las empresas seleccionadas (si no hay ninguna, todos).
  const centerOptions = useMemo(
    () => centers?.filter((c) => !idCompanies.length || idCompanies.includes(c.id_company)),
    [centers, idCompanies],
  );

  // Grupos a los que pertenece alguna de las peticiones ya filtradas por
  // empresa/curso/centro/estado (sin aplicar aún el propio filtro de grupo,
  // para no autoexcluirse) — igual que companyColumns en el pivote "Por curso".
  const groupOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of companyFilteredRequests ?? []) {
      for (const g of r.groups) map.set(g.id_group, g.group_name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [companyFilteredRequests]);

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

  const handleDuplicate = async (record: CourseRequest) => {
    try {
      const duplicated = await duplicateMutation.mutateAsync(record.id_request);
      messageApi.success("Petición duplicada");
      navigate(`/course-requests/${duplicated.id_request}`);
    } catch {
      messageApi.error("No se pudo duplicar la petición");
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
      key: "student_count",
      width: 70,
      ellipsis: true,
      sorter: (a, b) => a.in_group_student_count - b.in_group_student_count,
      render: (_: unknown, record: CourseRequest) => (
        <Tooltip title="En grupo ahora mismo / total">
          {record.in_group_student_count} / {record.student_count}
        </Tooltip>
      ),
    },
    {
      title: "Estado",
      dataIndex: "status",
      width: 100,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: CourseRequestStatus, record: CourseRequest) => {
        const isPartial = record.in_group_student_count > 0 && record.in_group_student_count < record.student_count;
        return (
          <>
            <Tag color={v === CourseRequestStatus.ABIERTA ? "processing" : "default"}>{v}</Tag>
            {isPartial && (
              <Tooltip title="No todos los alumnos de esta petición están (o siguen) en un grupo">
                <Tag color="gold">Parcial</Tag>
              </Tooltip>
            )}
          </>
        );
      },
    },
    {
      title: "Grupos",
      dataIndex: "groups",
      width: 110,
      ellipsis: true,
      sorter: (a, b) => a.groups.length - b.groups.length,
      render: (groups: CourseRequest["groups"]) =>
        groups.length
          ? groups.map((g) => (
              <Tag
                key={g.id_group}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(`/groups/${g.id_group}/edit`);
                }}
              >
                {g.group_name}
              </Tag>
            ))
          : "-",
    },
    ...(canEdit
      ? [
          {
            title: "",
            key: "actions",
            width: 50,
            render: (_: unknown, record: CourseRequest) => (
              <span onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Duplicar petición">
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    loading={duplicateMutation.isPending}
                    onClick={() => handleDuplicate(record)}
                  />
                </Tooltip>
              </span>
            ),
          },
        ]
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canEdit]);

  // Pivote "Por curso": se calcula en cliente a partir de `requests` (ya
  // filtrado por curso/centro/estado/empresa), para que siempre refleje los
  // filtros activos en pantalla — antes venía de un endpoint /stats aparte que
  // ignoraba estos filtros.
  const byCourse = useMemo(() => {
    const map = new Map<number, { id_course: number; course_name: string; request_count: number; student_count: number }>();
    for (const r of requests ?? []) {
      const entry = map.get(r.id_course) ?? { id_course: r.id_course, course_name: r.course_name, request_count: 0, student_count: 0 };
      entry.request_count += 1;
      entry.student_count += r.student_count;
      map.set(r.id_course, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.student_count - a.student_count);
  }, [requests]);

  // Curso x Empresa -> { alumnos, peticiones }, para rellenar las celdas del pivote
  // (las peticiones sin empresa no aportan a ninguna columna).
  const statsByCourseCompanyKey = useMemo(() => {
    const map = new Map<string, { request_count: number; student_count: number }>();
    for (const r of requests ?? []) {
      if (r.id_company == null) continue;
      const key = `${r.id_course}-${r.id_company}`;
      const entry = map.get(key) ?? { request_count: 0, student_count: 0 };
      entry.request_count += 1;
      entry.student_count += r.student_count;
      map.set(key, entry);
    }
    return map;
  }, [requests]);

  // Empresas con alguna petición (entre las filtradas), para las columnas
  // dinámicas del pivote (ordenadas por nombre, para que no bailen entre recargas).
  const companyColumns = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of requests ?? []) {
      if (r.id_company != null) map.set(r.id_company, r.company_name ?? "");
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const byCourseColumns = useMemo<ColumnsType<Record<string, unknown>>>(() => [
    {
      title: "Curso",
      dataIndex: "course_name",
      width: 200,
      ellipsis: true,
      sorter: (a, b) => String(a.course_name).localeCompare(String(b.course_name)),
      render: (v: string, record: Record<string, unknown>) => (
        <Typography.Link onClick={() => openDetail(`/courses/${record.id_course}`)}>{v}</Typography.Link>
      ),
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
      <Segmented<StatusFilter> data-tour="course-requests-status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
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
      <Select
        allowClear
        showSearch
        placeholder="Filtrar por grupo"
        style={{ minWidth: 220 }}
        value={idGroup}
        onChange={setIdGroup}
        optionFilterProp="label"
        options={groupOptions.map(([id_group, group_name]) => ({ value: id_group, label: group_name }))}
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
          dataSource={byCourse}
          columns={byCourseColumns}
          scroll={{ y: FIXED_TABLE_HEIGHT, x: isMobile ? "max-content" : undefined }}
        />
      </Card>
      <DataTable<CourseRequest>
        id="course-requests-table"
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
