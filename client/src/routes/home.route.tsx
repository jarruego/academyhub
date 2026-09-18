import { useMemo } from "react";
import { Button, Card, List, Row, Col, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/common/PageHeader";
import { ActiveTag } from "../components/common/tags";
import { useCoursesQuery } from "../hooks/api/courses/use-courses.query";
import { useAllGroupsQuery } from "../hooks/api/groups/use-all-groups.query";
import { useCourseCandidateCountsQuery } from "../hooks/api/course-candidates/use-course-candidates";
import { buildDashboardCourses, DashboardCourseRow } from "../utils/dashboard-courses.util";
import { getCourseProfile } from "../utils/course-profile";
import { formatDate } from "../utils/format";

/**
 * Cuadro de una de las dos secciones del dashboard (pública / resto): lista de
 * ediciones activas o con fechas futuras, con acceso a la ficha (grupos) y,
 * solo en financiación pública y si tiene alguna candidatura, a Candidatos.
 */
function DashboardCoursesCard({
  title,
  rows,
  loading,
  showCandidatesButton,
}: {
  title: string;
  rows: DashboardCourseRow[];
  loading: boolean;
  showCandidatesButton: boolean;
}) {
  const navigate = useNavigate();

  return (
    <Card title={title} styles={{ body: { maxHeight: 520, overflowY: "auto" } }}>
      <List<DashboardCourseRow>
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: "Sin ediciones activas ni próximas" }}
        renderItem={(row) => {
          const actions = [
            <Button key="ficha" size="small" onClick={() => navigate(`/courses/${row.id_course}`)}>
              Ficha
            </Button>,
          ];
          if (showCandidatesButton && row.candidate_count > 0) {
            actions.push(
              <Button key="candidatos" size="small" onClick={() => navigate(`/courses/${row.id_course}?tab=candidatos`)}>
                Candidatos ({row.candidate_count})
              </Button>,
            );
          }
          return (
            <List.Item actions={actions}>
              <List.Item.Meta
                title={
                  <span>
                    {row.catalog_course_name}
                    {row.file_number ? ` · Exp. ${row.file_number}` : ""}
                  </span>
                }
                description={
                  <Space size={8} wrap>
                    <ActiveTag active={row.is_active} activeLabel="En curso" inactiveLabel="Próximo" />
                    <Typography.Text type="secondary">
                      {row.is_active
                        ? row.relevant_end && `Termina: ${formatDate(row.relevant_end)}`
                        : row.relevant_start && `Empieza: ${formatDate(row.relevant_start)}`}
                    </Typography.Text>
                  </Space>
                }
              />
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
          <DashboardCoursesCard title="Financiación pública" rows={publicCourses} loading={loading} showCandidatesButton />
        </Col>
        <Col xs={24} lg={12}>
          <DashboardCoursesCard title="Resto de cursos" rows={otherCourses} loading={loading} showCandidatesButton={false} />
        </Col>
      </Row>
    </div>
  );
}
