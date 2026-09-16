import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { consultingCompetencyEvaluationTable } from "src/database/schema/tables/consulting_competency_evaluation.table";

@Injectable()
export class ConsultingCompetencyEvaluationRepository extends Repository {
  /** Todas las evaluaciones ya guardadas de un centro en una consultoría — para resolver el "efectivo" de cada trabajador en memoria, sin N+1. */
  async findByCenterEngagement(id_center: number, id_annual_engagement: number, options?: QueryOptions) {
    return this.query(options)
      .select()
      .from(consultingCompetencyEvaluationTable)
      .where(and(
        eq(consultingCompetencyEvaluationTable.id_center, id_center),
        eq(consultingCompetencyEvaluationTable.id_annual_engagement, id_annual_engagement),
      ));
  }

  async upsert(
    id_user: number,
    id_center: number,
    id_competency: number,
    id_annual_engagement: number,
    value: boolean | null,
    evaluated_by: number | undefined,
    options?: QueryOptions,
  ) {
    const rows = await this.query(options)
      .insert(consultingCompetencyEvaluationTable)
      .values({ id_user, id_center, id_competency, id_annual_engagement, value, evaluated_by, evaluated_at: new Date() })
      .onConflictDoUpdate({
        target: [
          consultingCompetencyEvaluationTable.id_user,
          consultingCompetencyEvaluationTable.id_center,
          consultingCompetencyEvaluationTable.id_competency,
          consultingCompetencyEvaluationTable.id_annual_engagement,
        ],
        set: { value, evaluated_by, evaluated_at: new Date() },
      })
      .returning();
    return rows[0];
  }
}
