import { serial, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { centerTable } from "./center.table";
import { userTable } from "./user.table";
import { consultingCompetencyTable } from "./consulting_competency.table";
import { consultingAnnualEngagementTable } from "./consulting_annual_engagement.table";
import { authUserTable } from "./auth_user.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Evaluación real de un trabajador, competencia a competencia, dentro de una
// consultoría anual concreta — `value` true = no necesita mejorar, false =
// necesita mejorar, NULL = no aplica a su puesto. Se autorrellena desde
// `consulting_position_competency_templates` según el puesto del
// trabajador, editable después. Ver docs/consultoria.md.
export const consultingCompetencyEvaluationTable = academyhubSchema.table('consulting_competency_evaluations', {
  id_competency_evaluation: serial().primaryKey(),
  id_user: integer().notNull().references(() => userTable.id_user),
  id_center: integer().notNull().references(() => centerTable.id_center),
  id_competency: integer().notNull().references(() => consultingCompetencyTable.id_competency),
  id_annual_engagement: integer().notNull().references(() => consultingAnnualEngagementTable.id_annual_engagement),
  value: boolean(),
  evaluated_at: timestamp().notNull().defaultNow(),
  evaluated_by: integer().references(() => authUserTable.id),
}, (table) => {
  return {
    engagementIdx: index("idx_consulting_competency_evaluations_id_annual_engagement").on(table.id_annual_engagement),
    uniqueIdx: uniqueIndex("idx_consulting_competency_evaluations_unique").on(table.id_user, table.id_center, table.id_competency, table.id_annual_engagement),
  };
});

export type ConsultingCompetencyEvaluationSelectModel = InferSelectModel<typeof consultingCompetencyEvaluationTable>;
export type ConsultingCompetencyEvaluationInsertModel = InferInsertModel<typeof consultingCompetencyEvaluationTable>;
