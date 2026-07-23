import { pgTable, serial, integer, text, index } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { courseRequestTable } from "./course_request.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Filas de alumnos de una petición ("hoja de cálculo"): texto en bruto, sin
// vínculo a `users` en esta fase. Alta por Excel o pegado manual, editables.
export const courseRequestStudentTable = pgTable('course_request_students', {
  id: serial().primaryKey(),
  id_request: integer().notNull().references(() => courseRequestTable.id_request, { onDelete: 'cascade' }),
  row_order: integer().notNull().default(0),
  name: text().notNull(),
  first_surname: text().notNull(),
  second_surname: text(),
  dni: text().notNull(),
  email: text().notNull(),
  phone_mobile: text(),
  ...TIMESTAMPS,
}, (table) => {
  return {
    // Listado de filas de una petición (detalle) en orden.
    requestIdx: index("idx_course_request_students_id_request").on(table.id_request),
  };
});

export type CourseRequestStudentSelectModel = InferSelectModel<typeof courseRequestStudentTable>;
export type CourseRequestStudentInsertModel = InferInsertModel<typeof courseRequestStudentTable>;
export type CourseRequestStudentUpdateModel = Partial<CourseRequestStudentInsertModel>;
