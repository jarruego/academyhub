import { useMemo, useState } from "react";
import { Button, Card, Input, List, Row, Col, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { useCoursesQuery } from "../hooks/api/courses/use-courses.query";
import { useAllGroupsQuery } from "../hooks/api/groups/use-all-groups.query";
import { useCourseCandidateCountsQuery } from "../hooks/api/course-candidates/use-course-candidates";
import { buildDashboardCourses, DashboardCourseRow, DashboardCourseStatus } from "../utils/dashboard-courses.util";
import { getCourseProfile } from "../utils/course-profile";
import { formatDate } from "../utils/format";
import { normalizeLoose, matchesLoose } from "../utils/normalize-search";
import { STATUS_COLORS } from "../theme/semantic-colors";

/** Nº de filas visibles antes de que el listado entre en scroll. */
const VISIBLE_ROWS = 10;
/** Alto fijo por fila — con esto el cuadro mide siempre exactamente `VISIBLE_ROWS` filas. */
const ROW_HEIGHT = 56;

const STATUS_LABEL: Record<DashboardCourseStatus, string> = {
  activo: "En curso",
  proximo: "Próximo",
  finalizado: "Finalizado",
};

const STATUS_TAG_COLOR: Record<DashboardCourseStatus, string> = {
  activo: STATUS_COLORS.active,
  proximo: STATUS_COLORS.processing,
  finalizado: STATUS_COLORS.neutral,
};

function CourseStatusTag({ status }: { status: DashboardCourseStatus }) {
  return <Tag color={STATUS_TAG_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
}

/**
 * Cuadro de una de las dos secciones del dashboard (pública / resto): lista de
 * ediciones del año en curso y futuras, con buscador propio (filtra por nº de
 * expediente, nombre corto o nombre del curso de catálogo dentro de la
 * tipología ya fijada por el cuadro) y acceso a la ficha (grupos) y, solo en
 * financiación pública y si tiene alguna candidatura, a Candidatos.
 * En financiación pública el nº de expediente va siempre delante del nombre
 * (es la referencia por la que se identifica la edición en ese ámbito).
 */
function DashboardCoursesCard({
  title,
  rows,
  loading,
  isPublicFunding,
}: {
  title: string;
  rows: DashboardCourseRow[];
  loading: boolean;
  isPublicFunding: boolean;
}) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  const normalizedSearch = normalizeLoose(searchText);
  const filteredRows = rows.filter((row) =>
    matchesLoose(normalizedSearch, [row.file_number, row.catalog_course_short_name, row.catalog_course_name]),
  );

  return (
    <Card title={title}>
      <Input.Search
        placeholder="Buscar por expediente, nombre corto o nombre"
        size="small"
        allowClear
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 12 }}
        aria-label={`Buscar en ${title}`}
      />
      <List<DashboardCourseRow>
        loading={loading}
        dataSource={filteredRows}
        locale={{ emptyText: "Sin ediciones del año en curso ni futuras" }}
        style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS, overflowY: "auto" }}
        renderItem={(row) => {
          const label = `${isPublicFunding && row.file_number ? `Exp. ${row.file_number} · ` : ""}${row.catalog_course_name ?? ""}${!isPublicFunding && row.file_number ? ` · Exp. ${row.file_number}` : ""}`;
          return (
            <List.Item style={{ height: ROW_HEIGHT, paddingInline: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8, minWidth: 0 }}>
                <Space size={8} style={{ minWidth: 0, flex: 1 }}>
                  <CourseStatusTag status={row.status} />
                  <Typography.Text ellipsis title={label} style={{ maxWidth: 260 }}>
                    {label}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                    {formatDate(row.reference_date)}
                  </Typography.Text>
                </Space>
                <Space size={4} style={{ flexShrink: 0 }}>
                  <Button size="small" onClick={() => navigate(`/courses/${row.id_course}`)}>
                    Ficha
                  </Button>
                  {isPublicFunding && row.candidate_count > 0 && (
                    <Button size="small" onClick={() => navigate(`/courses/${row.id_course}?tab=candidatos`)}>
                      Candidatos ({row.candidate_count})
                    </Button>
                  )}
                </Space>
              </div>
            </List.Item>
          );
        }}
      />
    </Card>
  );
}

export default function HomeRoute() {
  const { data: courses, isLoading: isCoursesLoading } = useCoursesQuery();
  const { data: groups, isLoading: isGroupsLoading } = useAllGroupsQuery();
  const { data: candidateCounts, isLoading: isCandidateCountsLoading } = useCourseCandidateCountsQuery();

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

  return (
    <div>
      <PageHeader title="Dashboard" documentTitle="Dashboard" />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <DashboardCoursesCard title="Financiación pública" rows={publicCourses} loading={loading} isPublicFunding />
        </Col>
        <Col xs={24} lg={12}>
          <DashboardCoursesCard title="Resto de cursos" rows={otherCourses} loading={loading} isPublicFunding={false} />
        </Col>
      </Row>
    </div>
  );
}
