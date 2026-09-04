import { integer, boolean, date, primaryKey, index, timestamp } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { userTable } from "./user.table";
import { courseTable } from "./course.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { PreinscriptionStatus } from "../../../types/preinscription/preinscription-status.enum";
import { PreinscriptionRegistrationSource } from "../../../types/preinscription/preinscription-registration-source.enum";
import { authUserTable } from "./auth_user.table";

export const preinscriptionStatus = academyhubSchema.enum('preinscription_status', Object.values(PreinscriptionStatus) as [string, ...string[]]);
export const preinscriptionRegistrationSource = academyhubSchema.enum('preinscription_registration_source', Object.values(PreinscriptionRegistrationSource) as [string, ...string[]]);

// Relación persona × curso/expediente para registrar una preinscripción (INAEM).
// Es una tabla de enlace (como user_course), NO una tabla de personas: todas las
// personas viven en `users`. Una persona puede preinscribirse a varios expedientes.
export const userPreinscriptionTable = academyhubSchema.table("user_preinscription", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  status: preinscriptionStatus("status").notNull().default(PreinscriptionStatus.PREINSCRITO),
  prioritaria: boolean("prioritaria").notNull().default(false),
  preinscription_date: date({ mode: 'date' }),
  registration_source: preinscriptionRegistrationSource().notNull().default(PreinscriptionRegistrationSource.INAEM_IMPORT),
  registered_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  verified_at: timestamp({ withTimezone: true }),
  verified_by: integer().references(() => authUserTable.id),
  last_imported_at: timestamp({ withTimezone: true }),
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
