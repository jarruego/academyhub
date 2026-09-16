import { serial, text, integer } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Catálogo fijo-pero-editable (ADMIN) de las 25 competencias evaluables por
// trabajador — ver docs/consultoria.md § Evaluación de competencias.
export const consultingCompetencyTable = academyhubSchema.table('consulting_competencies', {
  id_competency: serial().primaryKey(),
  name: text().notNull(),
  display_order: integer(),
});

export type ConsultingCompetencySelectModel = InferSelectModel<typeof consultingCompetencyTable>;
export type ConsultingCompetencyInsertModel = InferInsertModel<typeof consultingCompetencyTable>;
export type ConsultingCompetencyUpdateModel = Partial<ConsultingCompetencyInsertModel>;
