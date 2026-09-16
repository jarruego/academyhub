import { serial, text, integer } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { consultingJobPositionGroupTable } from "./consulting_job_position_group.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Catálogo fijo-pero-editable (ADMIN) de los 28 puestos de trabajo con
// plantilla de competencias propia — ver docs/consultoria.md § Evaluación de
// competencias. `id_job_position_group` agrupa puestos afines en el
// selector (p. ej. "Dirección"/"Cuidados") — antes era texto libre
// (`group_label`), pasó a FK 2026-09-16 para poder gestionar los grupos
// como entidad propia.
export const consultingJobPositionTable = academyhubSchema.table('consulting_job_positions', {
  id_job_position: serial().primaryKey(),
  name: text().notNull(),
  id_job_position_group: integer().references(() => consultingJobPositionGroupTable.id_job_position_group),
  display_order: integer(),
});

export type ConsultingJobPositionSelectModel = InferSelectModel<typeof consultingJobPositionTable>;
export type ConsultingJobPositionInsertModel = InferInsertModel<typeof consultingJobPositionTable>;
export type ConsultingJobPositionUpdateModel = Partial<ConsultingJobPositionInsertModel>;
