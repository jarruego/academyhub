import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingCompetencyTable,
  ConsultingCompetencyInsertModel,
  ConsultingCompetencyUpdateModel,
} from "src/database/schema/tables/consulting_competency.table";

@Injectable()
export class ConsultingCompetencyRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options).select().from(consultingCompetencyTable);
  }

  async create(data: ConsultingCompetencyInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingCompetencyTable).values(data).returning();
    return rows[0];
  }

  async update(id_competency: number, data: ConsultingCompetencyUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingCompetencyTable)
      .set(data)
      .where(eq(consultingCompetencyTable.id_competency, id_competency))
      .returning();
    return rows[0];
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(consultingCompetencyTable.display_order, consultingCompetencyTable.name);
  }

  async findById(id_competency: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingCompetencyTable.id_competency, id_competency));
    return rows[0];
  }

  async remove(id_competency: number, options?: QueryOptions) {
    await this.query(options).delete(consultingCompetencyTable).where(eq(consultingCompetencyTable.id_competency, id_competency));
  }
}
