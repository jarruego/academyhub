import { Course } from "../shared/types/course/course";
import { Group } from "../shared/types/group/group";
import { isGroupActive } from "./group-active.util";

/**
 * Filas del dashboard de Home: todas las ediciones cuyo grupo de fecha de fin
 * más tardía cae en el año en curso o en un año futuro (mismo criterio de
 * referencia que el listado de Ediciones — "Fecha Fin Grupo" — para que ambos
 * coincidan). Ordenadas por esa fecha, descendente (más recientes/futuras
 * arriba, más antiguas abajo). Las ediciones sin ningún grupo con `end_date`
 * no tienen forma de ubicarse en el tiempo y se excluyen.
 */
export type DashboardCourseStatus = "activo" | "proximo" | "finalizado";

export interface DashboardCourseRow extends Course {
  status: DashboardCourseStatus;
  reference_date: Date;
  candidate_count: number;
}

const toTime = (value?: Date | string | null): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export function buildDashboardCourses(
  courses: Course[],
  groups: Group[],
  candidateCountByCourse: Record<number, number>,
  now: Date = new Date(),
): DashboardCourseRow[] {
  const groupsByCourse = new Map<number, Group[]>();
  for (const group of groups) {
    const list = groupsByCourse.get(group.id_course);
    if (list) list.push(group);
    else groupsByCourse.set(group.id_course, [group]);
  }

  const currentYear = now.getFullYear();
  const rows: DashboardCourseRow[] = [];

  for (const course of courses) {
    const courseGroups = groupsByCourse.get(course.id_course) ?? [];

    let latestEndTime: number | null = null;
    for (const group of courseGroups) {
      const end = toTime(group.end_date);
      if (end != null && (latestEndTime == null || end > latestEndTime)) latestEndTime = end;
    }
    if (latestEndTime == null) continue;
    const referenceDate = new Date(latestEndTime);
    if (referenceDate.getFullYear() < currentYear) continue;

    const isActive = courseGroups.some((g) => isGroupActive(g, now));
    const isFuture =
      !isActive &&
      courseGroups.some((g) => {
        const start = toTime(g.start_date);
        return start != null && start > now.getTime();
      });
    const status: DashboardCourseStatus = isActive ? "activo" : isFuture ? "proximo" : "finalizado";

    rows.push({
      ...course,
      status,
      reference_date: referenceDate,
      candidate_count: candidateCountByCourse[course.id_course] ?? 0,
    });
  }

  return rows.sort((a, b) => b.reference_date.getTime() - a.reference_date.getTime());
}
