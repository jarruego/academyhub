import { describe, it, expect } from "vitest";
import { buildDashboardCourses } from "./dashboard-courses.util";
import { Course } from "../shared/types/course/course";
import { Group } from "../shared/types/group/group";
import { CourseModality } from "../shared/types/course/course-modality.enum";

const NOW = new Date("2026-06-16T12:00:00Z");
const day = (s: string) => new Date(s);

const course = (id_course: number, extra: Partial<Course> = {}): Course => ({
  id_course,
  id_catalog_course: id_course,
  course_name: `Curso ${id_course}`,
  modality: CourseModality.ONLINE,
  ...extra,
});

const group = (id_course: number, extra: Partial<Group> = {}): Group => ({
  id_group: id_course * 10,
  group_name: `Grupo ${id_course}`,
  id_course,
  ...extra,
});

describe("buildDashboardCourses", () => {
  it("descarta ediciones sin ningún grupo activo ni futuro", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2020-01-01"), end_date: day("2020-01-31") })];
    expect(buildDashboardCourses(courses, groups, {}, NOW)).toEqual([]);
  });

  it("incluye una edición con grupo activo, marcada como en curso con el fin del grupo activo", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2026-06-01"), end_date: day("2026-06-30") })];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.is_active).toBe(true);
    expect(row.relevant_end).toEqual(day("2026-06-30"));
  });

  it("incluye una edición sin grupo activo pero con un grupo futuro, marcada como próxima", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2026-07-01"), end_date: day("2026-07-31") })];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.is_active).toBe(false);
    expect(row.relevant_start).toEqual(day("2026-07-01"));
  });

  it("con varios grupos activos, usa el de fin más próximo como referencia", () => {
    const courses = [course(1)];
    const groups = [
      group(1, { id_group: 11, start_date: day("2026-06-01"), end_date: day("2026-06-30") }),
      group(1, { id_group: 12, start_date: day("2026-05-01"), end_date: day("2026-06-20") }),
    ];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.relevant_end).toEqual(day("2026-06-20"));
  });

  it("con varios grupos futuros, usa el de inicio más próximo como referencia", () => {
    const courses = [course(1)];
    const groups = [
      group(1, { id_group: 11, start_date: day("2026-08-01"), end_date: day("2026-08-31") }),
      group(1, { id_group: 12, start_date: day("2026-07-01"), end_date: day("2026-07-31") }),
    ];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.relevant_start).toEqual(day("2026-07-01"));
  });

  it("adjunta el nº de candidaturas por curso, 0 si no hay entrada", () => {
    const courses = [course(1), course(2)];
    const groups = [
      group(1, { start_date: day("2026-06-01"), end_date: day("2026-06-30") }),
      group(2, { start_date: day("2026-06-01"), end_date: day("2026-06-30") }),
    ];
    const rows = buildDashboardCourses(courses, groups, { 1: 5 }, NOW);
    expect(rows.find((r) => r.id_course === 1)?.candidate_count).toBe(5);
    expect(rows.find((r) => r.id_course === 2)?.candidate_count).toBe(0);
  });

  it("ordena: activas antes que próximas; dentro de activas por fin más próximo; dentro de próximas por inicio más próximo", () => {
    const courses = [course(1), course(2), course(3)];
    const groups = [
      // curso 1: próxima, empieza en agosto
      group(1, { start_date: day("2026-08-01"), end_date: day("2026-08-31") }),
      // curso 2: activa, termina el 25/06
      group(2, { start_date: day("2026-06-01"), end_date: day("2026-06-25") }),
      // curso 3: próxima, empieza en julio (antes que curso 1)
      group(3, { start_date: day("2026-07-01"), end_date: day("2026-07-31") }),
    ];
    const rows = buildDashboardCourses(courses, groups, {}, NOW);
    expect(rows.map((r) => r.id_course)).toEqual([2, 3, 1]);
  });
});
