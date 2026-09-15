import { serial, text, boolean, integer } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Catálogo editable (ADMIN) de valores de "Fecha" de una acción formativa de
// Consultoría — no es una fecha real, es una lista (A demanda, Según
// calendario central...). Propio de Consultoría, a diferencia de
// course_categories que es del núcleo — ver docs/consultoria.md.
export const consultingPlanningDateTable = academyhubSchema.table('consulting_planning_dates', {
  id_planning_date: serial().primaryKey(),
  name: text().notNull(),
  active: boolean().notNull().default(true),
  display_order: integer(),
  ...TIMESTAMPS,
});

export type ConsultingPlanningDateSelectModel = InferSelectModel<typeof consultingPlanningDateTable>;
export type ConsultingPlanningDateInsertModel = InferInsertModel<typeof consultingPlanningDateTable>;
export type ConsultingPlanningDateUpdateModel = Partial<ConsultingPlanningDateInsertModel>;
