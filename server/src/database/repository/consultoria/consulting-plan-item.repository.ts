import { Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingPlanItemTable,
  ConsultingPlanItemInsertModel,
} from "src/database/schema/tables/consulting_plan_item.table";
import { catalogCourseTable } from "src/database/schema/tables/course.table";
import { centerTable } from "src/database/schema/tables/center.table";
import { consultingActionDetailTable } from "src/database/schema/tables/consulting_action_detail.table";
import { courseCategoryTable } from "src/database/schema/tables/course_category.table";
import { consultingPlanningDateTable } from "src/database/schema/tables/consulting_planning_date.table";

const JOINED_COLUMNS = {
  id_plan_item: consultingPlanItemTable.id_plan_item,
  id_consulting_client: consultingPlanItemTable.id_consulting_client,
  id_annual_engagement: consultingPlanItemTable.id_annual_engagement,
  id_center: consultingPlanItemTable.id_center,
  center_name: centerTable.center_name,
  id_catalog_course: consultingPlanItemTable.id_catalog_course,
  name: catalogCourseTable.name,
  hours: catalogCourseTable.default_hours,
  modality: catalogCourseTable.default_modality,
  origin: consultingActionDetailTable.origin,
  category_name: courseCategoryTable.name,
  planning_date_name: consultingPlanningDateTable.name,
  added_by: consultingPlanItemTable.added_by,
  added_at: consultingPlanItemTable.added_at,
};

@Injectable()
export class ConsultingPlanItemRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(JOINED_COLUMNS)
      .from(consultingPlanItemTable)
      .innerJoin(catalogCourseTable, eq(consultingPlanItemTable.id_catalog_course, catalogCourseTable.id_catalog_course))
      .leftJoin(centerTable, eq(consultingPlanItemTable.id_center, centerTable.id_center))
      .leftJoin(consultingActionDetailTable, eq(consultingPlanItemTable.id_catalog_course, consultingActionDetailTable.id_catalog_course))
      .leftJoin(courseCategoryTable, eq(consultingActionDetailTable.id_category, courseCategoryTable.id_category))
      .leftJoin(consultingPlanningDateTable, eq(consultingActionDetailTable.id_planning_date, consultingPlanningDateTable.id_planning_date));
  }

  // Plan completo de una consultoría: base (id_center NULL) + lo propio de cada centro.
  async findByEngagementId(id_annual_engagement: number, options?: QueryOptions) {
    return this.baseQuery(options)
      .where(eq(consultingPlanItemTable.id_annual_engagement, id_annual_engagement))
      .orderBy(catalogCourseTable.name);
  }

  async findById(id_plan_item: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingPlanItemTable.id_plan_item, id_plan_item));
    return rows[0];
  }

  async findLink(id_annual_engagement: number, id_center: number | null, id_catalog_course: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingPlanItemTable)
      .where(and(
        eq(consultingPlanItemTable.id_annual_engagement, id_annual_engagement),
        id_center === null ? isNull(consultingPlanItemTable.id_center) : eq(consultingPlanItemTable.id_center, id_center),
        eq(consultingPlanItemTable.id_catalog_course, id_catalog_course),
      ));
    return rows[0];
  }

  // ¿Esta acción está en el plan efectivo de este centro (base o propia), en esta consultoría?
  // Usado para validar antes de crear una evaluación de acción o un asistente manual.
  async existsForCenter(id_annual_engagement: number, id_center: number, id_catalog_course: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingPlanItemTable)
      .where(and(
        eq(consultingPlanItemTable.id_annual_engagement, id_annual_engagement),
        eq(consultingPlanItemTable.id_catalog_course, id_catalog_course),
        or(isNull(consultingPlanItemTable.id_center), eq(consultingPlanItemTable.id_center, id_center)),
      ));
    return rows.length > 0;
  }

  async addItem(data: ConsultingPlanItemInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingPlanItemTable).values(data).returning();
    return rows[0];
  }

  async removeItem(id_plan_item: number, options?: QueryOptions) {
    await this.query(options).delete(consultingPlanItemTable).where(eq(consultingPlanItemTable.id_plan_item, id_plan_item));
  }

  /**
   * Al abrir una consultoría nueva, copia el plan (base + propio de cada
   * centro que siga participando) de la consultoría anterior como punto de
   * partida editable — nunca arranca vacío si hay un año previo. Ver
   * docs/consultoria.md.
   */
  async clonePlan(fromEngagementId: number, toEngagementId: number, toParticipatingCenterIds: number[], options?: QueryOptions) {
    const sourceItems = await this.query(options)
      .select()
      .from(consultingPlanItemTable)
      .where(eq(consultingPlanItemTable.id_annual_engagement, fromEngagementId));

    const centersSet = new Set(toParticipatingCenterIds);
    const toInsert: ConsultingPlanItemInsertModel[] = sourceItems
      .filter((item) => item.id_center === null || centersSet.has(item.id_center))
      .map((item) => ({
        id_consulting_client: item.id_consulting_client,
        id_annual_engagement: toEngagementId,
        id_center: item.id_center,
        id_catalog_course: item.id_catalog_course,
        added_by: item.added_by,
      }));

    if (toInsert.length === 0) return [];
    return this.query(options).insert(consultingPlanItemTable).values(toInsert).returning();
  }
}
