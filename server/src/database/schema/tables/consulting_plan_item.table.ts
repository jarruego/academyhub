import { serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { consultingClientTable } from "./consulting_client.table";
import { consultingAnnualEngagementTable } from "./consulting_annual_engagement.table";
import { centerTable } from "./center.table";
import { catalogCourseTable } from "./course.table";
import { authUserTable } from "./auth_user.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Plan de formación de Consultoría: propio de cada consultoría anual, no
// compartido entre ejercicios — corregido 2026-09-16, el primer diseño era
// continuo/sin año; un usuario hizo notar que el plan de un cliente (y de
// cada centro) puede variar de un año a otro. Al abrir una consultoría
// nueva, el plan se clona de la anterior como punto de partida editable
// (ver `ConsultingPlanItemRepository.clonePlan`), no arranca vacío.
// `id_center` NULL = plan base de esta consultoría, compartido por los
// centros que participan en ella; con valor = añadido propio de ese
// centro, por encima del base. `id_catalog_course` referencia siempre una
// acción formativa ya etiquetada (fila en `consulting_action_details`), no
// cualquier curso de catálogo — se valida en el servicio, no aquí.
export const consultingPlanItemTable = academyhubSchema.table('consulting_plan_items', {
  id_plan_item: serial().primaryKey(),
  id_consulting_client: integer().notNull().references(() => consultingClientTable.id_consulting_client),
  id_annual_engagement: integer().notNull().references(() => consultingAnnualEngagementTable.id_annual_engagement),
  id_center: integer().references(() => centerTable.id_center),
  id_catalog_course: integer().notNull().references(() => catalogCourseTable.id_catalog_course),
  // Nullable: null si lo añadió el token de acceso externo de un centro.
  added_by: integer().references(() => authUserTable.id),
  added_at: timestamp().notNull().defaultNow(),
}, (table) => {
  return {
    clientIdx: index("idx_consulting_plan_items_id_consulting_client").on(table.id_consulting_client),
    engagementIdx: index("idx_consulting_plan_items_id_annual_engagement").on(table.id_annual_engagement),
    centerIdx: index("idx_consulting_plan_items_id_center").on(table.id_center),
    catalogCourseIdx: index("idx_consulting_plan_items_id_catalog_course").on(table.id_catalog_course),
  };
});

export type ConsultingPlanItemSelectModel = InferSelectModel<typeof consultingPlanItemTable>;
export type ConsultingPlanItemInsertModel = InferInsertModel<typeof consultingPlanItemTable>;
