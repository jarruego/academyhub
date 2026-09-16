import { Injectable } from "@nestjs/common";
import { desc, eq, and } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingAnnualEngagementTable,
  ConsultingAnnualEngagementInsertModel,
} from "src/database/schema/tables/consulting_annual_engagement.table";
import { ConsultingEngagementStatus } from "src/types/consulting/consulting-engagement-status.enum";

@Injectable()
export class ConsultingAnnualEngagementRepository extends Repository {
  async findByClientId(id_consulting_client: number, options?: QueryOptions) {
    return this.query(options)
      .select()
      .from(consultingAnnualEngagementTable)
      .where(eq(consultingAnnualEngagementTable.id_consulting_client, id_consulting_client))
      .orderBy(desc(consultingAnnualEngagementTable.year));
  }

  async findByClientAndYear(id_consulting_client: number, year: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingAnnualEngagementTable)
      .where(and(eq(consultingAnnualEngagementTable.id_consulting_client, id_consulting_client), eq(consultingAnnualEngagementTable.year, year)));
    return rows[0];
  }

  async findById(id_annual_engagement: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingAnnualEngagementTable)
      .where(eq(consultingAnnualEngagementTable.id_annual_engagement, id_annual_engagement));
    return rows[0];
  }

  async open(data: ConsultingAnnualEngagementInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingAnnualEngagementTable).values(data).returning();
    return rows[0];
  }

  async setStatus(id_annual_engagement: number, status: ConsultingEngagementStatus, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingAnnualEngagementTable)
      .set({
        status,
        closed_at: status === ConsultingEngagementStatus.CLOSED ? new Date() : null,
      })
      .where(eq(consultingAnnualEngagementTable.id_annual_engagement, id_annual_engagement))
      .returning();
    return rows[0];
  }
}
