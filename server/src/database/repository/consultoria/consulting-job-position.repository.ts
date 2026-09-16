import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingJobPositionTable,
  ConsultingJobPositionInsertModel,
  ConsultingJobPositionUpdateModel,
} from "src/database/schema/tables/consulting_job_position.table";
import { consultingJobPositionGroupTable } from "src/database/schema/tables/consulting_job_position_group.table";

const JOINED_COLUMNS = {
  id_job_position: consultingJobPositionTable.id_job_position,
  name: consultingJobPositionTable.name,
  id_job_position_group: consultingJobPositionTable.id_job_position_group,
  group_name: consultingJobPositionGroupTable.name,
  display_order: consultingJobPositionTable.display_order,
};

@Injectable()
export class ConsultingJobPositionRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(JOINED_COLUMNS)
      .from(consultingJobPositionTable)
      .leftJoin(consultingJobPositionGroupTable, eq(consultingJobPositionTable.id_job_position_group, consultingJobPositionGroupTable.id_job_position_group));
  }

  async create(data: ConsultingJobPositionInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingJobPositionTable).values(data).returning();
    return rows[0];
  }

  async update(id_job_position: number, data: ConsultingJobPositionUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingJobPositionTable)
      .set(data)
      .where(eq(consultingJobPositionTable.id_job_position, id_job_position))
      .returning();
    return rows[0];
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(consultingJobPositionTable.display_order, consultingJobPositionTable.name);
  }

  async findById(id_job_position: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingJobPositionTable.id_job_position, id_job_position));
    return rows[0];
  }

  async remove(id_job_position: number, options?: QueryOptions) {
    await this.query(options).delete(consultingJobPositionTable).where(eq(consultingJobPositionTable.id_job_position, id_job_position));
  }
}
