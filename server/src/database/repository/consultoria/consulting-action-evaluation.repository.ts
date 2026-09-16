import { Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingActionEvaluationTable,
  ConsultingActionEvaluationInsertModel,
  ConsultingActionEvaluationUpdateModel,
} from "src/database/schema/tables/consulting_action_evaluation.table";
import { catalogCourseTable } from "src/database/schema/tables/course.table";
import { centerTable } from "src/database/schema/tables/center.table";
import { consultingAnnualEngagementTable } from "src/database/schema/tables/consulting_annual_engagement.table";

const JOINED_COLUMNS = {
  id_action_evaluation: consultingActionEvaluationTable.id_action_evaluation,
  id_catalog_course: consultingActionEvaluationTable.id_catalog_course,
  name: catalogCourseTable.name,
  id_center: consultingActionEvaluationTable.id_center,
  id_annual_engagement: consultingActionEvaluationTable.id_annual_engagement,
  evaluation_date: consultingActionEvaluationTable.evaluation_date,
  evaluation_text: consultingActionEvaluationTable.evaluation_text,
  percentage: consultingActionEvaluationTable.percentage,
  imparte_text: consultingActionEvaluationTable.imparte_text,
  evaluated_by: consultingActionEvaluationTable.evaluated_by,
  createdAt: consultingActionEvaluationTable.createdAt,
};

@Injectable()
export class ConsultingActionEvaluationRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(JOINED_COLUMNS)
      .from(consultingActionEvaluationTable)
      .innerJoin(catalogCourseTable, eq(consultingActionEvaluationTable.id_catalog_course, catalogCourseTable.id_catalog_course));
  }

  /** Evaluaciones de un centro dentro de una consultoría concreta — vive dentro de ella, ver docs/consultoria.md. */
  async findByCenterAndEngagement(id_center: number, id_annual_engagement: number, options?: QueryOptions) {
    return this.baseQuery(options)
      .where(and(eq(consultingActionEvaluationTable.id_center, id_center), eq(consultingActionEvaluationTable.id_annual_engagement, id_annual_engagement)))
      .orderBy(consultingActionEvaluationTable.evaluation_date);
  }

  /**
   * ¿Ya se ha evaluado esta acción en alguno de estos centros? Usado para
   * bloquear el borrado de un ítem del plan (base o propio) que ya tiene
   * histórico de evaluación — ver docs/consultoria.md.
   */
  async findByCatalogCourseAndCenters(id_catalog_course: number, id_centers: number[], options?: QueryOptions) {
    if (id_centers.length === 0) return [];
    return this.query(options)
      .select({
        id_center: consultingActionEvaluationTable.id_center,
        center_name: centerTable.center_name,
        year: consultingAnnualEngagementTable.year,
      })
      .from(consultingActionEvaluationTable)
      .innerJoin(centerTable, eq(consultingActionEvaluationTable.id_center, centerTable.id_center))
      .innerJoin(consultingAnnualEngagementTable, eq(consultingActionEvaluationTable.id_annual_engagement, consultingAnnualEngagementTable.id_annual_engagement))
      .where(and(
        eq(consultingActionEvaluationTable.id_catalog_course, id_catalog_course),
        inArray(consultingActionEvaluationTable.id_center, id_centers),
      ));
  }

  async findById(id_action_evaluation: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingActionEvaluationTable.id_action_evaluation, id_action_evaluation));
    return rows[0];
  }

  async create(data: ConsultingActionEvaluationInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingActionEvaluationTable).values(data).returning();
    return this.findById(rows[0].id_action_evaluation, options);
  }

  async update(id_action_evaluation: number, data: ConsultingActionEvaluationUpdateModel, options?: QueryOptions) {
    await this.query(options)
      .update(consultingActionEvaluationTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultingActionEvaluationTable.id_action_evaluation, id_action_evaluation));
    return this.findById(id_action_evaluation, options);
  }

  async remove(id_action_evaluation: number, options?: QueryOptions) {
    await this.query(options).delete(consultingActionEvaluationTable).where(eq(consultingActionEvaluationTable.id_action_evaluation, id_action_evaluation));
  }
}
