import { serial, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { consultingJobPositionTable } from "./consulting_job_position.table";
import { consultingCompetencyTable } from "./consulting_competency.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Configurador (ADMIN/CONSULTOR) que autorrellena la evaluación de un
// trabajador a partir de su puesto: `default_value` true = no necesita
// mejorar, false = necesita mejorar, NULL = la competencia no aplica a ese
// puesto (queda en blanco). Editable después por trabajador. Ver
// docs/consultoria.md.
export const consultingPositionCompetencyTemplateTable = academyhubSchema.table('consulting_position_competency_templates', {
  id_position_competency_template: serial().primaryKey(),
  id_job_position: integer().notNull().references(() => consultingJobPositionTable.id_job_position),
  id_competency: integer().notNull().references(() => consultingCompetencyTable.id_competency),
  default_value: boolean(),
}, (table) => {
  return {
    uniquePairIdx: uniqueIndex("idx_consulting_position_competency_templates_unique_pair").on(table.id_job_position, table.id_competency),
  };
});

export type ConsultingPositionCompetencyTemplateSelectModel = InferSelectModel<typeof consultingPositionCompetencyTemplateTable>;
export type ConsultingPositionCompetencyTemplateInsertModel = InferInsertModel<typeof consultingPositionCompetencyTemplateTable>;
