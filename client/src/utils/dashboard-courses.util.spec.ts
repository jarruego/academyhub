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
  it("descarta ediciones sin ningún grupo con end_date", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2026-06-01"), end_date: null })];
    expect(buildDashboardCourses(courses, groups, {}, NOW)).toEqual([]);
  });

  it("descarta ediciones cuyo grupo con fin más tardío es de un año anterior", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2025-01-01"), end_date: day("2025-01-31") })];
    expect(buildDashboardCourses(courses, groups, {}, NOW)).toEqual([]);
  });

  it("incluye una edición del año en curso, marcada 'activo' si tiene un grupo activo", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2026-06-01"), end_date: day("2026-06-30") })];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.status).toBe("activo");
    expect(row.reference_date).toEqual(day("2026-06-30"));
  });

  it("marca 'proximo' una edición futura sin grupo activo", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2026-07-01"), end_date: day("2026-07-31") })];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.status).toBe("proximo");
  });

  it("marca 'finalizado' una edición del año en curso ya terminada", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2026-01-01"), end_date: day("2026-01-31") })];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.status).toBe("finalizado");
  });

  it("incluye una edición de un año futuro", () => {
    const courses = [course(1)];
    const groups = [group(1, { start_date: day("2027-01-01"), end_date: day("2027-01-31") })];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.status).toBe("proximo");
  });

  it("usa el fin de grupo más tardío como fecha de referencia", () => {
    const courses = [course(1)];
    const groups = [
      group(1, { id_group: 11, start_date: day("2026-05-01"), end_date: day("2026-06-20") }),
      group(1, { id_group: 12, start_date: day("2026-06-01"), end_date: day("2026-08-31") }),
    ];
    const [row] = buildDashboardCourses(courses, groups, {}, NOW);
    expect(row.reference_date).toEqual(day("2026-08-31"));
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

  it("ordena por fecha de referencia descendente (más recientes/futuras arriba)", () => {
    const courses = [course(1), course(2), course(3)];
    const groups = [
      group(1, { start_date: day("2026-01-01"), end_date: day("2026-01-31") }), // finalizado, más antiguo
      group(2, { start_date: day("2027-01-01"), end_date: day("2027-01-31") }), // futuro, el más lejano
      group(3, { start_date: day("2026-06-01"), end_date: day("2026-06-25") }), // activo
    ];
    const rows = buildDashboardCourses(courses, groups, {}, NOW);
    expect(rows.map((r) => r.id_course)).toEqual([2, 3, 1]);
  });
});
