import { serial, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { consultingClientTable } from "./consulting_client.table";
import { centerTable } from "./center.table";
import { authUserTable } from "./auth_user.table";
import { ConsultingEngagementStatus } from "../../../types/consulting/consulting-engagement-status.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const consultingEngagementStatus = academyhubSchema.enum(
  'consulting_engagement_status',
  Object.values(ConsultingEngagementStatus) as [string, ...string[]],
);

// La consultoría anual: una por cliente y ejercicio — no "auditoría", eso lo
// reciben los centros/clientes de un tercero (ISO/SGE21/...); esto es
// nuestra herramienta para prepararlos. Contenedor único, sin sub-estado por
// centro — los centros que participan son solo una lista de pertenencia
// (`consulting_engagement_centers`), no una auditoría propia con su propio
// ciclo de vida. Corregido 2026-09-16 tras dos vueltas: primero se modeló
// por centro ("consulting_annual_audits", con ambigüedad al haber dos años
// abiertos a la vez), luego se vio que ni siquiera debía existir ese nivel
// intermedio — la consultoría es del cliente, el centro es un participante.
// Ver docs/consultoria.md.
export const consultingAnnualEngagementTable = academyhubSchema.table('consulting_annual_engagements', {
  id_annual_engagement: serial().primaryKey(),
  id_consulting_client: integer().notNull().references(() => consultingClientTable.id_consulting_client),
  year: integer().notNull(),
  status: consultingEngagementStatus().notNull().default(ConsultingEngagementStatus.OPEN),
  opened_at: timestamp().notNull().defaultNow(),
  closed_at: timestamp(),
  created_by: integer().references(() => authUserTable.id),
}, (table) => {
  return {
    clientIdx: index("idx_consulting_annual_engagements_id_consulting_client").on(table.id_consulting_client),
    // Una sola consultoría por cliente y año.
    uniqueClientYearIdx: uniqueIndex("idx_consulting_annual_engagements_unique_client_year").on(table.id_consulting_client, table.year),
  };
});

// Centros que participan en una consultoría anual — pertenencia simple, sin
// estado ni fechas propias. Por defecto, todos los del cliente al abrirla;
// ampliable/reducible después.
export const consultingEngagementCenterTable = academyhubSchema.table('consulting_engagement_centers', {
  id_engagement_center: serial().primaryKey(),
  id_annual_engagement: integer().notNull().references(() => consultingAnnualEngagementTable.id_annual_engagement),
  id_center: integer().notNull().references(() => centerTable.id_center),
}, (table) => {
  return {
    engagementIdx: index("idx_consulting_engagement_centers_id_annual_engagement").on(table.id_annual_engagement),
    uniquePairIdx: uniqueIndex("idx_consulting_engagement_centers_unique_pair").on(table.id_annual_engagement, table.id_center),
  };
});

export type ConsultingAnnualEngagementSelectModel = InferSelectModel<typeof consultingAnnualEngagementTable>;
export type ConsultingAnnualEngagementInsertModel = InferInsertModel<typeof consultingAnnualEngagementTable>;

export type ConsultingEngagementCenterSelectModel = InferSelectModel<typeof consultingEngagementCenterTable>;
export type ConsultingEngagementCenterInsertModel = InferInsertModel<typeof consultingEngagementCenterTable>;
