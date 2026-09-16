import { serial, integer, date, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { catalogCourseTable } from "./course.table";
import { centerTable } from "./center.table";
import { userTable } from "./user.table";
import { consultingAnnualEngagementTable } from "./consulting_annual_engagement.table";
import { authUserTable } from "./auth_user.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Registro manual de asistentes de una acción formativa, por centro y
// consultoría anual — solo para acciones sin matrícula real (edición/grupo)
// que derivar: formación externa, o propia de Mecohisa sin catalogar
// todavía (caso Marisa). Para una acción con ediciones reales, el cuadro se
// deriva de la matrícula existente (courses/groups/user_group) y no se
// registra aquí — ver docs/consultoria.md § Cuadro de formación por centro.
export const consultingActionAttendeeTable = academyhubSchema.table('consulting_action_attendees', {
  id_action_attendee: serial().primaryKey(),
  id_catalog_course: integer().notNull().references(() => catalogCourseTable.id_catalog_course),
  id_center: integer().notNull().references(() => centerTable.id_center),
  id_user: integer().notNull().references(() => userTable.id_user),
  id_annual_engagement: integer().notNull().references(() => consultingAnnualEngagementTable.id_annual_engagement),
  // Fecha en que hizo la acción — no hay edición/matrícula real de la que leerla.
  attended_at: date({ mode: 'date' }).notNull().defaultNow(),
  // Nullable: null si lo creó el token de acceso externo de un centro.
  created_by: integer().references(() => authUserTable.id),
  ...TIMESTAMPS,
}, (table) => {
  return {
    uniqueIdx: uniqueIndex("idx_consulting_action_attendees_unique").on(table.id_catalog_course, table.id_center, table.id_annual_engagement, table.id_user),
  };
});

export type ConsultingActionAttendeeSelectModel = InferSelectModel<typeof consultingActionAttendeeTable>;
export type ConsultingActionAttendeeInsertModel = InferInsertModel<typeof consultingActionAttendeeTable>;
