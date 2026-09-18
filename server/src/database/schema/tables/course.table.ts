import { serial, integer, text, boolean, decimal, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { CourseModality } from "../../../types/course/course-modality.enum";
import { CourseClient } from "../../../types/course/course-client.enum";
import { CourseFunding } from "../../../types/course/course-funding.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const courseModality = academyhubSchema.enum('course_modality', Object.values(CourseModality) as [string, ...string[]]);
export const courseClient = academyhubSchema.enum('course_client', Object.values(CourseClient) as [string, ...string[]]);
export const courseFunding = academyhubSchema.enum('course_funding', Object.values(CourseFunding) as [string, ...string[]]);

export const catalogCourseTable = academyhubSchema.table('catalog_courses', {
  id_catalog_course: serial().primaryKey(),
  name: text().notNull(),
  normalized_name: text().notNull(),
  // Nombre corto del curso de catálogo (p.ej. para SMS, donde cuenta cada
  // carácter) — antes existía a nivel de edición (`courses.short_name`,
  // eliminado: todos sus usos reales —búsqueda, duplicador de foros, export
  // CSV de SMS— pasaron a este campo estable de catálogo). Distinto de
  // `internal_code` (código, no nombre). Usado por la plantilla de SMS como
  // {NOMBRE_CURSO_CORTO} — ver docs/sms.md.
  short_name: text().notNull(),
  internal_code: text(),
  description: text(),
  objectives: text(),
  base_contents: text(),
  default_modality: courseModality(),
  default_hours: integer(),
  // A quién va dirigido el curso (p. ej. "Personal de cocina") — propiedad
  // estable del curso, no de una edición concreta. Antes solo existía
  // `courses.target_audience` (a nivel de edición, gateado a la pestaña
  // INAEM); este es el equivalente a nivel de catálogo, usado por
  // Consultoría — ver docs/consultoria.md.
  target_audience: text(),
  sepe_specialty_code: text(),
  sepe_specialty_name: text(),
  professional_family: text(),
  professional_area: text(),
  // Contenidos HTML de la formación, compartidos por todas las ediciones (antes
  // vivían duplicados en cada edición, en `courses.contents` — migración 0076
  // hizo el backfill desde la edición más reciente con datos y borró esa columna).
  contents: text(),
  // Oculta el curso de catálogo de los selects de filtro/búsqueda (peticiones,
  // interesados) sin afectar a los listados normales ni a la asignación de
  // curso de catálogo de una edición. Solo ADMIN puede marcarlo.
  hidden_from_filters: boolean().notNull().default(false),
  ...TIMESTAMPS,
}, (table) => ({
  normalizedNameIdx: uniqueIndex("idx_catalog_courses_normalized_name").on(table.normalized_name),
  internalCodeIdx: uniqueIndex("idx_catalog_courses_internal_code").on(table.internal_code),
}));

export const courseTable = academyhubSchema.table('courses', {
  id_course: serial().primaryKey(),
  id_catalog_course: integer().notNull().references(() => catalogCourseTable.id_catalog_course),
  moodle_id: integer(),
  course_name: text().notNull(),
  start_date: timestamp({withTimezone: true}),
  end_date: timestamp({withTimezone: true}),
  modality: courseModality().notNull(),
  hours: integer(), 
  price_per_hour: decimal({ precision: 10, scale: 2 }).$type<number>(),
  // Legacy column. The authoritative "active" state is now derived from the
  // course's groups (see utils/group-active.util.ts). Kept for backward
  // compatibility; defaults to false and is no longer forced by Moodle import.
  active: boolean().notNull().default(false),
  fundae_id: text(),
  // Nº de expediente del INAEM (p.ej. "25/0202.001"). Clave de matching en la
  // importación INAEM y campo manual para etiquetar cursos ya existentes y
  // evitar duplicados. Null en cursos no INAEM.
  file_number: text(),
  // Cliente/comitente del curso (INAEM/VITALIA/OTRO). Null hasta clasificar.
  // El ámbito público/privado se deriva de `funding`, no de aquí.
  client: courseClient(),
  // Financiación del curso: ¿cómo se paga? (PRIVADA/FUNDAE/PUBLICA). Eje ortogonal
  // al cliente y del que se deriva el ámbito. Null hasta clasificar; INAEM ⇒ PUBLICA.
  funding: courseFunding(),
  // Curso provisional autocreado durante la importación INAEM cuando llegó un
  // alumno/preinscrito de un expediente sin curso. Se completa al importar Acciones.
  is_provisional: boolean().notNull().default(false),
  capacity: integer(),
  selection_at: timestamp({withTimezone: true}),
  selection_place: text(),
  training_place: text(),
  target_audience: text(),
  admission_requirements: text(),
  required_documentation: text(),
  planned_schedule: text(),
  coordinator: text(),
  organization_notes: text(),
  moodle_synced_at: timestamp({withTimezone: true}),
  ...TIMESTAMPS,
}, (table) => {
  return {
    // file_number: único (no dos cursos con el mismo nº de expediente) y clave de
    // matching en la importación INAEM. Los NULL no colisionan entre sí en Postgres,
    // así que los cursos sin expediente conviven sin problema.
    fileNumberIdx: uniqueIndex("idx_courses_file_number").on(table.file_number),
    catalogCourseIdx: index("idx_courses_id_catalog_course").on(table.id_catalog_course),
  };
});

export type CourseSelectModel = InferSelectModel<typeof courseTable>;
export type CourseInsertModel = InferInsertModel<typeof courseTable>;
export type CourseUpdateModel = Partial<CourseInsertModel>;
export type CatalogCourseSelectModel = InferSelectModel<typeof catalogCourseTable>;
export type CatalogCourseInsertModel = InferInsertModel<typeof catalogCourseTable>;
export type CatalogCourseUpdateModel = Partial<CatalogCourseInsertModel>;


