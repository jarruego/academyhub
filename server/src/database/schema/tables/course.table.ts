import { pgTable, serial, integer, text, date, boolean, decimal, pgEnum, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { CourseModality } from "../../../types/course/course-modality.enum";
import { CourseClient } from "../../../types/course/course-client.enum";
import { CourseFunding } from "../../../types/course/course-funding.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const courseModality = pgEnum('course_modality', Object.values(CourseModality) as [string, ...string[]]);
export const courseClient = pgEnum('course_client', Object.values(CourseClient) as [string, ...string[]]);
export const courseFunding = pgEnum('course_funding', Object.values(CourseFunding) as [string, ...string[]]);

export const courseTable = pgTable('courses', {
  id_course: serial().primaryKey(),
  moodle_id: integer(),
  course_name: text().notNull(),
  category: text(),
  short_name: text().notNull(),
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
  contents: text(), // HTML largo
  moodle_synced_at: timestamp({withTimezone: true}),
  ...TIMESTAMPS,
}, (table) => {
  return {
    // file_number: único (no dos cursos con el mismo nº de expediente) y clave de
    // matching en la importación INAEM. Los NULL no colisionan entre sí en Postgres,
    // así que los cursos sin expediente conviven sin problema.
    fileNumberIdx: uniqueIndex("idx_courses_file_number").on(table.file_number),
  };
});

export type CourseSelectModel = InferSelectModel<typeof courseTable>;
export type CourseInsertModel = InferInsertModel<typeof courseTable>;
export type CourseUpdateModel = Partial<CourseInsertModel>;



