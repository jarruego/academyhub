import { serial, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { centerTable } from "./center.table";
import { userTable } from "./user.table";
import { consultingAnnualEngagementTable } from "./consulting_annual_engagement.table";
import { authUserTable } from "./auth_user.table";
import { ConsultingRosterAdjustmentType } from "../../../types/consulting/consulting-roster-adjustment-type.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const consultingRosterAdjustmentType = academyhubSchema.enum(
  'consulting_roster_adjustment_type',
  Object.values(ConsultingRosterAdjustmentType) as [string, ...string[]],
);

// Ajuste manual del roster de un centro, dentro de una consultoría anual
// concreta — nunca toca la asociación real centro-trabajador
// (`user_center`). El roster efectivo de un centro en una consultoría =
// trabajadores reales activos ese año (`user_center.start_date`/`end_date`
// solapando el año de la consultoría) ∪ ajustes ADD de esa consultoría −
// ajustes REMOVE de esa consultoría. Ver docs/consultoria.md.
export const consultingRosterAdjustmentTable = academyhubSchema.table('consulting_roster_adjustments', {
  id_roster_adjustment: serial().primaryKey(),
  id_center: integer().notNull().references(() => centerTable.id_center),
  id_user: integer().notNull().references(() => userTable.id_user),
  id_annual_engagement: integer().notNull().references(() => consultingAnnualEngagementTable.id_annual_engagement),
  adjustment_type: consultingRosterAdjustmentType().notNull(),
  // Nullable: null si lo creó el token de acceso externo de un centro.
  created_by: integer().references(() => authUserTable.id),
  ...TIMESTAMPS,
}, (table) => {
  return {
    // Un solo ajuste vivo por trabajador, centro y consultoría — editar el tipo en vez de acumular filas.
    uniqueIdx: uniqueIndex("idx_consulting_roster_adjustments_unique").on(table.id_center, table.id_user, table.id_annual_engagement),
  };
});

export type ConsultingRosterAdjustmentSelectModel = InferSelectModel<typeof consultingRosterAdjustmentTable>;
export type ConsultingRosterAdjustmentInsertModel = InferInsertModel<typeof consultingRosterAdjustmentTable>;
