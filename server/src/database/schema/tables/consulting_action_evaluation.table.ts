import { serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { catalogCourseTable } from "./course.table";
import { centerTable } from "./center.table";
import { consultingAnnualEngagementTable } from "./consulting_annual_engagement.table";
import { authUserTable } from "./auth_user.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Evaluación de una acción formativa del plan, hecha por/para un centro
// concreto — utilidad y cumplimiento del objetivo desde el punto de vista
// del cliente auditado, no la satisfacción del alumno (eso va aparte). Dos
// campos separados a propósito (ver docs/consultoria.md): `evaluation_text`
// explica el caso, `percentage` lo hace filtrable/explotable — el servicio
// exige `evaluation_text` cuando `percentage < 50`. `id_annual_engagement`
// es explícito (la consultoría dentro de la que se hace, nunca "la abierta").
export const consultingActionEvaluationTable = academyhubSchema.table('consulting_action_evaluations', {
  id_action_evaluation: serial().primaryKey(),
  id_catalog_course: integer().notNull().references(() => catalogCourseTable.id_catalog_course),
  id_center: integer().notNull().references(() => centerTable.id_center),
  id_annual_engagement: integer().notNull().references(() => consultingAnnualEngagementTable.id_annual_engagement),
  evaluation_date: timestamp().notNull(),
  evaluation_text: text(),
  percentage: integer(),
  // Empresa/centro de formación que impartió la acción.
  imparte_text: text(),
  // Nullable: null si lo creó el token de acceso externo de un centro.
  evaluated_by: integer().references(() => authUserTable.id),
  ...TIMESTAMPS,
}, (table) => {
  return {
    catalogCourseIdx: index("idx_consulting_action_evaluations_id_catalog_course").on(table.id_catalog_course),
    centerIdx: index("idx_consulting_action_evaluations_id_center").on(table.id_center),
    engagementIdx: index("idx_consulting_action_evaluations_id_annual_engagement").on(table.id_annual_engagement),
  };
});

export type ConsultingActionEvaluationSelectModel = InferSelectModel<typeof consultingActionEvaluationTable>;
export type ConsultingActionEvaluationInsertModel = InferInsertModel<typeof consultingActionEvaluationTable>;
export type ConsultingActionEvaluationUpdateModel = Partial<ConsultingActionEvaluationInsertModel>;
