import { pgTable, serial, integer, text, timestamp, date, pgEnum, index } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { centerTable } from "./center.table";
import { courseTable } from "./course.table";
import { authUserTable } from "./auth_user.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { CourseRequestStatus } from "../../../types/course-request/course-request-status.enum";
import { CourseRequestSource } from "../../../types/course-request/course-request-source.enum";

export const courseRequestStatus = pgEnum('course_request_status', Object.values(CourseRequestStatus) as [string, ...string[]]);
export const courseRequestSource = pgEnum('course_request_source', Object.values(CourseRequestSource) as [string, ...string[]]);

// Petición de formación de un centro: cabecera. Las filas de alumnos viven en
// course_request_students. En esta fase no se toca `users`/matrícula: los
// datos de alumnos son texto en bruto, editable como una hoja de cálculo.
export const courseRequestTable = pgTable('course_requests', {
  id_request: serial().primaryKey(),
  // Nullable: lo normal es que la petición tenga centro, pero no se bloquea si falta
  // (se avisa en el cliente).
  id_center: integer().references(() => centerTable.id_center),
  id_course: integer().notNull().references(() => courseTable.id_course),
  // Fecha de la petición (cuándo la hizo el centro). Por defecto la fecha de
  // alta, pero editable (p. ej. si se sube tarde una petición ya recibida antes).
  request_date: date({ mode: 'date' }).notNull().defaultNow(),
  // Correo de contacto del centro para esta petición (para futuros informes de
  // seguimiento). Se prellena desde center.contact_email pero es editable/nullable.
  contact_email: text(),
  status: courseRequestStatus().notNull().default(CourseRequestStatus.ABIERTA),
  source: courseRequestSource().notNull().default(CourseRequestSource.MANUAL),
  notes: text(),
  created_by: integer().references(() => authUserTable.id),
  closed_at: timestamp({ withTimezone: true }),
  ...TIMESTAMPS,
}, (table) => {
  return {
    // Listado/dashboard: peticiones por curso y por centro/empresa.
    courseIdx: index("idx_course_requests_id_course").on(table.id_course),
    centerIdx: index("idx_course_requests_id_center").on(table.id_center),
    statusIdx: index("idx_course_requests_status").on(table.status),
  };
});

export type CourseRequestSelectModel = InferSelectModel<typeof courseRequestTable>;
export type CourseRequestInsertModel = InferInsertModel<typeof courseRequestTable>;
export type CourseRequestUpdateModel = Partial<CourseRequestInsertModel>;
