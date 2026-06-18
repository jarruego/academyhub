import { pgTable, integer, boolean, date, pgEnum, primaryKey, index } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { courseTable } from "./course.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { PreinscriptionStatus } from "../../../types/preinscription/preinscription-status.enum";

export const preinscriptionStatus = pgEnum('preinscription_status', Object.values(PreinscriptionStatus) as [string, ...string[]]);

// Relación persona × curso/expediente para registrar una preinscripción (INAEM).
// Es una tabla de enlace (como user_course), NO una tabla de personas: todas las
// personas viven en `users`. Una persona puede preinscribirse a varios expedientes.
export const userPreinscriptionTable = pgTable("user_preinscription", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  status: preinscriptionStatus("status").notNull().default(PreinscriptionStatus.PREINSCRITO),
  prioritaria: boolean("prioritaria").notNull().default(false),
  preinscription_date: date({ mode: 'date' }),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.id_user, table.id_course] }),
    // id_course: lookup inverso "preinscritos de un curso"
    courseIdx: index("idx_user_preinscription_id_course").on(table.id_course),
  };
});

export type UserPreinscriptionSelectModel = InferSelectModel<typeof userPreinscriptionTable>;
export type UserPreinscriptionInsertModel = InferInsertModel<typeof userPreinscriptionTable>;
export type UserPreinscriptionUpdateModel = Partial<UserPreinscriptionInsertModel>;
