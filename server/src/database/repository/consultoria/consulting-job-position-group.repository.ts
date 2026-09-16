import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingJobPositionGroupTable,
  ConsultingJobPositionGroupInsertModel,
  ConsultingJobPositionGroupUpdateModel,
} from "src/database/schema/tables/consulting_job_position_group.table";

@Injectable()
export class ConsultingJobPositionGroupRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options).select().from(consultingJobPositionGroupTable);
  }

  async create(data: ConsultingJobPositionGroupInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingJobPositionGroupTable).values(data).returning();
    return rows[0];
  }

  async update(id_job_position_group: number, data: ConsultingJobPositionGroupUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingJobPositionGroupTable)
      .set(data)
      .where(eq(consultingJobPositionGroupTable.id_job_position_group, id_job_position_group))
      .returning();
    return rows[0];
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(consultingJobPositionGroupTable.display_order, consultingJobPositionGroupTable.name);
  }

  async findById(id_job_position_group: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingJobPositionGroupTable.id_job_position_group, id_job_position_group));
    return rows[0];
  }

  async remove(id_job_position_group: number, options?: QueryOptions) {
    await this.query(options).delete(consultingJobPositionGroupTable).where(eq(consultingJobPositionGroupTable.id_job_position_group, id_job_position_group));
  }
}
