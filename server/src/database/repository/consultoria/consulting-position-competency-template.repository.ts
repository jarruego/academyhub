import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { consultingPositionCompetencyTemplateTable } from "src/database/schema/tables/consulting_position_competency_template.table";

@Injectable()
export class ConsultingPositionCompetencyTemplateRepository extends Repository {
  async findAll(options?: QueryOptions) {
    return this.query(options).select().from(consultingPositionCompetencyTemplateTable);
  }

  async findByJobPosition(id_job_position: number, options?: QueryOptions) {
    return this.query(options)
      .select()
      .from(consultingPositionCompetencyTemplateTable)
      .where(eq(consultingPositionCompetencyTemplateTable.id_job_position, id_job_position));
  }

  async upsert(id_job_position: number, id_competency: number, default_value: boolean | null, options?: QueryOptions) {
    const rows = await this.query(options)
      .insert(consultingPositionCompetencyTemplateTable)
      .values({ id_job_position, id_competency, default_value })
      .onConflictDoUpdate({
        target: [consultingPositionCompetencyTemplateTable.id_job_position, consultingPositionCompetencyTemplateTable.id_competency],
        set: { default_value },
      })
      .returning();
    return rows[0];
  }

  async remove(id_job_position: number, id_competency: number, options?: QueryOptions) {
    await this.query(options)
      .delete(consultingPositionCompetencyTemplateTable)
      .where(and(
        eq(consultingPositionCompetencyTemplateTable.id_job_position, id_job_position),
        eq(consultingPositionCompetencyTemplateTable.id_competency, id_competency),
      ));
  }
}
