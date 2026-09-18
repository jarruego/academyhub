import { Course } from "../shared/types/course/course";
import { Group } from "../shared/types/group/group";
import { isGroupActive } from "./group-active.util";

/**
 * Filas del dashboard de Home (cursos activos o con fechas futuras). Deriva,
 * por edición, si está en curso ahora mismo o si arranca en el futuro
 * (mismo criterio de "activo" que el resto de la app — `isGroupActive` — más
 * el caso "todavía no ha empezado"), y el grupo de referencia para mostrar
 * fecha: el de fin más próximo si está en curso, o el de inicio más próximo
 * si es futuro. Las ediciones sin grupo activo ni futuro no aparecen.
 */
export interface DashboardCourseRow extends Course {
  is_active: boolean;
  relevant_start: Date | null;
  relevant_end: Date | null;
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

  const rows: DashboardCourseRow[] = [];

  for (const course of courses) {
    const courseGroups = groupsByCourse.get(course.id_course) ?? [];
    const activeGroups = courseGroups.filter((g) => isGroupActive(g, now));
    const futureGroups = courseGroups.filter((g) => {
      if (isGroupActive(g, now)) return false;
      const start = toTime(g.start_date);
      return start != null && start > now.getTime();
    });
    if (activeGroups.length === 0 && futureGroups.length === 0) continue;

    const isActive = activeGroups.length > 0;
    const relevantGroup = isActive
      ? activeGroups.reduce((soonest, candidate) => {
          const soonestEnd = toTime(soonest.end_date);
          const candidateEnd = toTime(candidate.end_date);
          if (soonestEnd == null) return candidate;
          if (candidateEnd == null) return soonest;
          return candidateEnd < soonestEnd ? candidate : soonest;
        })
      : futureGroups.reduce((soonest, candidate) =>
          (toTime(candidate.start_date) ?? Infinity) < (toTime(soonest.start_date) ?? Infinity) ? candidate : soonest,
        );

    rows.push({
      ...course,
      is_active: isActive,
      relevant_start: relevantGroup.start_date ? new Date(relevantGroup.start_date) : null,
      relevant_end: relevantGroup.end_date ? new Date(relevantGroup.end_date) : null,
      candidate_count: candidateCountByCourse[course.id_course] ?? 0,
    });
  }

  return rows.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (a.is_active) return (a.relevant_end?.getTime() ?? Infinity) - (b.relevant_end?.getTime() ?? Infinity);
    return (a.relevant_start?.getTime() ?? Infinity) - (b.relevant_start?.getTime() ?? Infinity);
  });
}
