import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingPlanningDateTable,
  ConsultingPlanningDateInsertModel,
  ConsultingPlanningDateUpdateModel,
} from "src/database/schema/tables/consulting_planning_date.table";

@Injectable()
export class ConsultingPlanningDateRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options).select().from(consultingPlanningDateTable);
  }

  async create(data: ConsultingPlanningDateInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingPlanningDateTable).values(data).returning();
    return rows[0];
  }

  async update(id_planning_date: number, data: ConsultingPlanningDateUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingPlanningDateTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultingPlanningDateTable.id_planning_date, id_planning_date))
      .returning();
    return rows[0];
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(consultingPlanningDateTable.display_order, consultingPlanningDateTable.name);
  }

  async findById(id_planning_date: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingPlanningDateTable.id_planning_date, id_planning_date));
    return rows[0];
  }
}
