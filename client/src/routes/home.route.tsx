import { useMemo, useState } from "react";
import { AutoComplete, Button, Card, Input, Table, Row, Col, Space, Tag, Typography, theme } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import logo from "../assets/logo.png";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { PageHeader } from "../components/common/PageHeader";
import { useCoursesQuery } from "../hooks/api/courses/use-courses.query";
import { useAllGroupsQuery } from "../hooks/api/groups/use-all-groups.query";
import { useCourseCandidateCountsQuery } from "../hooks/api/course-candidates/use-course-candidates";
import { useLastInaemImportQuery } from "../hooks/api/import-inaem/useInaemImport";
import { useGlobalSearchQuery } from "../hooks/api/search/use-global-search.query";
import { useDebounce } from "../hooks/use-debounce";
import { buildDashboardCourses, DashboardCourseRow, DashboardCourseStatus } from "../utils/dashboard-courses.util";
import { getCourseProfile } from "../utils/course-profile";
import { formatDate } from "../utils/format";
import { normalizeLoose, matchesLoose } from "../utils/normalize-search";
import { STATUS_COLORS } from "../theme/semantic-colors";

/** Alto aproximado del cuerpo de la tabla para que se vean ~10 filas antes de entrar en scroll. */
const TABLE_SCROLL_Y = 440;

const STATUS_LABEL: Record<DashboardCourseStatus, string> = {
  activo: "En curso",
  proximo: "Próximo",
  finalizado: "Finalizado",
};

const STATUS_RANK: Record<DashboardCourseStatus, number> = {
  activo: 0,
  proximo: 1,
  finalizado: 2,
};

const STATUS_TAG_COLOR: Record<DashboardCourseStatus, string> = {
  activo: STATUS_COLORS.active,
  proximo: STATUS_COLORS.warning,
  // "neutral" (default) es un tag apagado por diseño de antd, casi sin color visible
  // sobre el fondo blanco de la tabla — se reutiliza el mismo rojo que `ActiveTag`
  // usa para "Inactivo" en el resto de la app (misma condición: sin grupo activo).
  finalizado: STATUS_COLORS.inactive,
};

function CourseStatusTag({ status }: { status: DashboardCourseStatus }) {
  return <Tag color={STATUS_TAG_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}

type GlobalSearchOption = { value: string; label: string; url: string };
type GlobalSearchGroup = { label: string; options: GlobalSearchOption[] };

/**
 * Buscador global de la parte superior del dashboard: busca a la vez en
 * usuarios, ediciones, empresas y centros (`GET api/search`, con debounce) y
 * agrupa los resultados por categoría en el desplegable. Seleccionar un
 * resultado navega directamente a su ficha.
 */
function GlobalSearchBox() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const debouncedTerm = useDebounce(inputValue, 300);
  const { data, isFetching } = useGlobalSearchQuery(debouncedTerm);

  const options = useMemo<GlobalSearchGroup[]>(() => {
    if (!data) return [];
    const groups: GlobalSearchGroup[] = [];
    if (data.users.length) {
      groups.push({
        label: "Usuarios",
        options: data.users.map((u) => ({
          value: `user-${u.id_user}`,
          label: `${u.name} ${u.first_surname ?? ""} ${u.second_surname ?? ""}`.replace(/\s+/g, " ").trim() + (u.dni ? ` · ${u.dni}` : ""),
          url: `/users/${u.id_user}`,
        })),
      });
    }
    if (data.courses.length) {
      groups.push({
        label: "Cursos",
        options: data.courses.map((c) => ({
          value: `course-${c.id_course}`,
          label: `${c.catalog_course_name}${c.file_number ? ` · Exp. ${c.file_number}` : ""}`,
          url: `/courses/${c.id_course}`,
        })),
      });
    }
    if (data.companies.length) {
      groups.push({
        label: "Empresas",
        options: data.companies.map((c) => ({
          value: `company-${c.id_company}`,
          label: `${c.company_name} · ${c.cif}`,
          url: `/companies/${c.id_company}`,
        })),
      });
    }
    if (data.centers.length) {
      groups.push({
        label: "Centros",
        options: data.centers.map((c) => ({
          value: `center-${c.id_center}`,
          label: c.center_name,
          url: `/centers/${c.id_center}/edit`,
        })),
      });
    }
    return groups;
  }, [data]);

  const trimmedLength = debouncedTerm.trim().length;
  const noResults = trimmedLength >= 2 && !isFetching && options.length === 0;
  const notFoundContent = trimmedLength > 0 && trimmedLength < 2
    ? "Escribe al menos 2 caracteres"
    : noResults
    ? "Sin resultados"
    : undefined;

  return (
    <AutoComplete
      style={{ width: "100%", maxWidth: 520 }}
      options={options}
      value={inputValue}
      filterOption={false}
      onSearch={setInputValue}
      onSelect={(_, option) => {
        navigate((option as unknown as GlobalSearchOption).url);
        setInputValue("");
      }}
      notFoundContent={notFoundContent}
    >
      <Input.Search placeholder="Buscar usuario, curso, empresa o centro..." allowClear loading={isFetching} aria-label="Buscador global" />
    </AutoComplete>
  );
}

/**
 * Cuadro de una de las dos secciones del dashboard (pública / resto): tabla de
 * ediciones del año en curso y futuras, con columnas ordenables y buscador
 * propio (filtra por nº de expediente, nombre corto o nombre del curso de
 * catálogo dentro de la tipología ya fijada por el cuadro). Cada fila tiene un
 * botón Ficha y, solo en financiación pública y si tiene alguna candidatura,
 * un botón de acceso a Candidatos (icono + nº entre paréntesis).
 */
function DashboardCoursesCard({
  title,
  subtitle,
  rows,
  loading,
  isPublicFunding,
}: {
  title: string;
  /** Texto pequeño junto al título (p. ej. fecha de la última importación INAEM). */
  subtitle?: string;
  rows: DashboardCourseRow[];
  loading: boolean;
  isPublicFunding: boolean;
}) {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState("");

  // Diferencia visualmente los dos cuadros (cabecera + borde) sin salirse de la
  // paleta del tema: financiación pública usa el color primario, el resto el
  // "info" de antd — ambos tokens, así siguen el modo oscuro automáticamente.
  const accentBg = isPublicFunding ? token.colorPrimaryBg : token.colorInfoBg;
  const accentBorder = isPublicFunding ? token.colorPrimaryBorder : token.colorInfoBorder;

  const normalizedSearch = normalizeLoose(searchText);
  const filteredRows = rows.filter((row) =>
    matchesLoose(normalizedSearch, [row.file_number, row.catalog_course_short_name, row.catalog_course_name]),
  );

  const columns = useMemo<ColumnsType<DashboardCourseRow>>(() => {
    const cols: ColumnsType<DashboardCourseRow> = [
      {
        title: "Estado",
        dataIndex: "status",
        key: "status",
        width: 110,
        render: (status: DashboardCourseStatus) => <CourseStatusTag status={status} />,
        sorter: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
      },
    ];
    if (isPublicFunding) {
      cols.push({
        title: "Nº Exp.",
        dataIndex: "file_number",
        key: "file_number",
        width: 110,
        render: (v: string | null) => v || "-",
        sorter: (a, b) => (a.file_number ?? "").localeCompare(b.file_number ?? ""),
      });
    }
    cols.push(
      {
        title: "Curso",
        dataIndex: "catalog_course_name",
        key: "catalog_course_name",
        ellipsis: true,
        sorter: (a, b) => (a.catalog_course_name ?? "").localeCompare(b.catalog_course_name ?? ""),
      },
      {
        title: "Fecha",
        dataIndex: "reference_date",
        key: "reference_date",
        width: 110,
        render: (d: Date) => formatDate(d),
        sorter: (a, b) => a.reference_date.getTime() - b.reference_date.getTime(),
        defaultSortOrder: "descend",
      },
      {
        title: "",
        key: "actions",
        width: isPublicFunding ? 140 : 80,
        render: (_, row) => (
          <Space size={4}>
            <Button type="primary" size="small" onClick={() => navigate(`/courses/${row.id_course}`)}>
              Ficha
            </Button>
            {isPublicFunding && row.candidate_count > 0 && (
              <Button
                type="primary"
                ghost
                size="small"
                icon={<TeamOutlined />}
                title="Candidatos"
                onClick={() => navigate(`/courses/${row.id_course}?tab=candidatos`)}
              >
                ({row.candidate_count})
              </Button>
            )}
          </Space>
        ),
      },
    );
    return cols;
  }, [isPublicFunding, navigate]);

  const viewAllUrl = isPublicFunding ? "/courses?tab=publica" : "/courses?tab=todos";

  return (
    <Card
      title={
        <Space size={8} align="baseline">
          <span>{title}</span>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontWeight: "normal", fontSize: 12 }}>
              {subtitle}
            </Typography.Text>
          )}
        </Space>
      }
      extra={<Button size="small" onClick={() => navigate(viewAllUrl)}>Ver todos</Button>}
      style={{ borderColor: accentBorder }}
      styles={{ header: { background: accentBg, borderColor: accentBorder } }}
    >
      <Input.Search
        placeholder="Buscar por expediente, nombre corto o nombre"
        size="small"
        allowClear
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 12 }}
        aria-label={`Buscar en ${title}`}
      />
      <Table<DashboardCourseRow>
        rowKey="id_course"
        columns={columns}
        dataSource={filteredRows}
        loading={loading}
        pagination={false}
        scroll={{ y: TABLE_SCROLL_Y }}
        locale={{ emptyText: "Sin ediciones del año en curso ni futuras" }}
      />
    </Card>
  );
}

export default function HomeRoute() {
  const { data: courses, isLoading: isCoursesLoading } = useCoursesQuery();
  const { data: groups, isLoading: isGroupsLoading } = useAllGroupsQuery();
  const { data: candidateCounts, isLoading: isCandidateCountsLoading } = useCourseCandidateCountsQuery();
  const { data: lastInaemImport } = useLastInaemImportQuery();

  const candidateCountByCourse = useMemo(() => {
    const map: Record<number, number> = {};
    for (const row of candidateCounts ?? []) map[row.id_course] = row.count;
    return map;
  }, [candidateCounts]);

  const dashboardCourses = useMemo(
    () => buildDashboardCourses(courses ?? [], groups ?? [], candidateCountByCourse),
    [courses, groups, candidateCountByCourse],
  );

  const publicCourses = useMemo(
    () => dashboardCourses.filter((c) => getCourseProfile({ funding: c.funding }).isPublic),
    [dashboardCourses],
  );
  const otherCourses = useMemo(
    () => dashboardCourses.filter((c) => !getCourseProfile({ funding: c.funding }).isPublic),
    [dashboardCourses],
  );

  const loading = isCoursesLoading || isGroupsLoading || isCandidateCountsLoading;
  const lastInaemImportLabel = lastInaemImport?.completedAt
    ? `Última importación INAEM: ${formatDate(lastInaemImport.completedAt)}`
    : undefined;

  return (
    <div>
      <PageHeader title="Dashboard" documentTitle="Dashboard" />
      <GlobalSearchBox />
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <DashboardCoursesCard
            title="Financiación pública"
            subtitle={lastInaemImportLabel}
            rows={publicCourses}
            loading={loading}
            isPublicFunding
          />
        </Col>
        <Col xs={24} lg={12}>
          <DashboardCoursesCard title="Resto de cursos" rows={otherCourses} loading={loading} isPublicFunding={false} />
        </Col>
      </Row>
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <img src={logo} alt="AcademyHub" style={{ width: 120, opacity: 0.6 }} />
      </div>
    </div>
  );
}
