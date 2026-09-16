import { serial, text, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Catálogo editable (ADMIN) de grupos de puestos de trabajo — agrupación
// puramente visual del catálogo de puestos (p. ej. "Dirección", "Cuidados").
// Antes era texto libre (`consulting_job_positions.group_label`) — pasó a
// ser una entidad propia 2026-09-16 (pedido del usuario, para poder
// gestionar los grupos en sí: listarlos, renombrarlos, borrarlos) sin dejar
// de ser una simple agrupación visual, sin más efecto en la app. Ver
// docs/consultoria.md.
export const consultingJobPositionGroupTable = academyhubSchema.table('consulting_job_position_groups', {
  id_job_position_group: serial().primaryKey(),
  name: text().notNull(),
  display_order: integer(),
}, (table) => {
  return {
    uniqueNameIdx: uniqueIndex("idx_consulting_job_position_groups_unique_name").on(table.name),
  };
});

export type ConsultingJobPositionGroupSelectModel = InferSelectModel<typeof consultingJobPositionGroupTable>;
export type ConsultingJobPositionGroupInsertModel = InferInsertModel<typeof consultingJobPositionGroupTable>;
export type ConsultingJobPositionGroupUpdateModel = Partial<ConsultingJobPositionGroupInsertModel>;
