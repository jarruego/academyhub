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

  // Plan completo de un cliente: base (id_center NULL) + lo propio de cada centro.
  async findByClientId(id_consulting_client: number, options?: QueryOptions) {
    return this.baseQuery(options)
      .where(eq(consultingPlanItemTable.id_consulting_client, id_consulting_client))
      .orderBy(catalogCourseTable.name);
  }

  async findById(id_plan_item: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingPlanItemTable.id_plan_item, id_plan_item));
    return rows[0];
  }

  async findLink(id_consulting_client: number, id_center: number | null, id_catalog_course: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingPlanItemTable)
      .where(and(
        eq(consultingPlanItemTable.id_consulting_client, id_consulting_client),
        id_center === null ? isNull(consultingPlanItemTable.id_center) : eq(consultingPlanItemTable.id_center, id_center),
        eq(consultingPlanItemTable.id_catalog_course, id_catalog_course),
      ));
    return rows[0];
  }

  // ¿Esta acción está en el plan efectivo de este centro (base o propia)?
  // Usado para validar antes de crear una evaluación de acción.
  async existsForCenter(id_consulting_client: number, id_center: number, id_catalog_course: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingPlanItemTable)
      .where(and(
        eq(consultingPlanItemTable.id_consulting_client, id_consulting_client),
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
}
