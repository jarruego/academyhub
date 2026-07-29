import { serial, integer, text, index } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { courseRequestTable } from "./course_request.table";
import { groupTable } from "./group.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Filas de alumnos de una petición ("hoja de cálculo"): texto en bruto, sin
// vínculo a `users` en esta fase. Alta por Excel o pegado manual, editables.
export const courseRequestStudentTable = academyhubSchema.table('course_request_students', {
  id: serial().primaryKey(),
  id_request: integer().notNull().references(() => courseRequestTable.id_request, { onDelete: 'cascade' }),
  row_order: integer().notNull().default(0),
  name: text().notNull(),
  first_surname: text().notNull(),
  second_surname: text(),
  dni: text().notNull(),
  email: text().notNull(),
  phone_mobile: text(),
  // Grupo al que se matriculó este alumno concreto desde la petición (null =
  // aún sin matricular). Permite repartir los alumnos de una misma petición
  // entre varios grupos: los ya asignados no se pueden volver a seleccionar.
  id_group: integer().references(() => groupTable.id_group),
  ...TIMESTAMPS,
}, (table) => {
  return {
    // Listado de filas de una petición (detalle) en orden.
    requestIdx: index("idx_course_request_students_id_request").on(table.id_request),
    groupIdx: index("idx_course_request_students_id_group").on(table.id_group),
  };
});

export type CourseRequestStudentSelectModel = InferSelectModel<typeof courseRequestStudentTable>;
export type CourseRequestStudentInsertModel = InferInsertModel<typeof courseRequestStudentTable>;
export type CourseRequestStudentUpdateModel = Partial<CourseRequestStudentInsertModel>;
