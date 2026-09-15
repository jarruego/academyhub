import { integer } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from "./timestamps";
import { catalogCourseTable } from "./course.table";
import { courseCategoryTable } from "./course_category.table";
import { consultingPlanningDateTable } from "./consulting_planning_date.table";
import { authUserTable } from "./auth_user.table";
import { ConsultingActionOrigin } from "../../../types/consulting/consulting-action-origin.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const consultingActionOrigin = academyhubSchema.enum('consulting_action_origin', Object.values(ConsultingActionOrigin) as [string, ...string[]]);

// Satélite 1:1 de Consultoría sobre un curso de catálogo (`catalog_courses`)
// existente — "acción formativa" en el sentido de docs/consultoria.md. Cuelga
// del curso de catálogo, no de una edición concreta: Nombre/Horas/Modalidad/
// Objetivos/Dirigido a ya viven en `catalog_courses` (Objetivos y Dirigido a
// reutilizados directamente, sin duplicar) — esta tabla solo añade lo que de
// verdad es propio de Consultoría: origen, categoría y fecha de
// planificación. Qué ediciones/alumnos/centros concretos hicieron el curso
// (y cuándo) se resuelve más adelante, al construir el cuadro de formación —
// no aquí.
export const consultingActionDetailTable = academyhubSchema.table('consulting_action_details', {
  id_catalog_course: integer().primaryKey().references(() => catalogCourseTable.id_catalog_course),
  origin: consultingActionOrigin().notNull().default(ConsultingActionOrigin.OWN),
  id_category: integer().references(() => courseCategoryTable.id_category),
  id_planning_date: integer().references(() => consultingPlanningDateTable.id_planning_date),
  // Nullable: null si lo creó/editó el token de acceso externo de un centro
  // (usuario técnico, ver docs/consultoria.md), no una persona real.
  created_by: integer().references(() => authUserTable.id),
  ...TIMESTAMPS,
});

export type ConsultingActionDetailSelectModel = InferSelectModel<typeof consultingActionDetailTable>;
export type ConsultingActionDetailInsertModel = InferInsertModel<typeof consultingActionDetailTable>;
export type ConsultingActionDetailUpdateModel = Partial<ConsultingActionDetailInsertModel>;
