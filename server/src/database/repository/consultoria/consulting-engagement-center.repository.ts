import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { consultingAnnualEngagementTable, consultingEngagementCenterTable } from "src/database/schema/tables/consulting_annual_engagement.table";
import { consultingClientTable } from "src/database/schema/tables/consulting_client.table";
import { centerTable } from "src/database/schema/tables/center.table";

@Injectable()
export class ConsultingEngagementCenterRepository extends Repository {
  /** Consultorías en las que participa un centro — usado por el acceso externo (token) para listar "sus" años. */
  async findByCenterId(id_center: number, options?: QueryOptions) {
    return this.query(options)
      .select({
        id_annual_engagement: consultingAnnualEngagementTable.id_annual_engagement,
        id_consulting_client: consultingAnnualEngagementTable.id_consulting_client,
        client_name: consultingClientTable.name,
        year: consultingAnnualEngagementTable.year,
        status: consultingAnnualEngagementTable.status,
      })
      .from(consultingEngagementCenterTable)
      .innerJoin(consultingAnnualEngagementTable, eq(consultingEngagementCenterTable.id_annual_engagement, consultingAnnualEngagementTable.id_annual_engagement))
      .innerJoin(consultingClientTable, eq(consultingAnnualEngagementTable.id_consulting_client, consultingClientTable.id_consulting_client))
      .where(eq(consultingEngagementCenterTable.id_center, id_center))
      .orderBy(desc(consultingAnnualEngagementTable.year));
  }

  async findByEngagementId(id_annual_engagement: number, options?: QueryOptions) {
    return this.query(options)
      .select({
        id_engagement_center: consultingEngagementCenterTable.id_engagement_center,
        id_center: centerTable.id_center,
        center_name: centerTable.center_name,
      })
      .from(consultingEngagementCenterTable)
      .innerJoin(centerTable, eq(consultingEngagementCenterTable.id_center, centerTable.id_center))
      .where(eq(consultingEngagementCenterTable.id_annual_engagement, id_annual_engagement))
      .orderBy(centerTable.center_name);
  }

  async findLink(id_annual_engagement: number, id_center: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingEngagementCenterTable)
      .where(and(eq(consultingEngagementCenterTable.id_annual_engagement, id_annual_engagement), eq(consultingEngagementCenterTable.id_center, id_center)));
    return rows[0];
  }

  async isParticipant(id_annual_engagement: number, id_center: number, options?: QueryOptions) {
    return !!(await this.findLink(id_annual_engagement, id_center, options));
  }

  async addCenter(id_annual_engagement: number, id_center: number, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingEngagementCenterTable).values({ id_annual_engagement, id_center }).returning();
    return rows[0];
  }

  async addCenters(id_annual_engagement: number, id_centers: number[], options?: QueryOptions) {
    if (id_centers.length === 0) return [];
    return this.query(options).insert(consultingEngagementCenterTable).values(id_centers.map((id_center) => ({ id_annual_engagement, id_center }))).returning();
  }

  async removeCenter(id_annual_engagement: number, id_center: number, options?: QueryOptions) {
    await this.query(options).delete(consultingEngagementCenterTable).where(and(eq(consultingEngagementCenterTable.id_annual_engagement, id_annual_engagement), eq(consultingEngagementCenterTable.id_center, id_center)));
  }

  async removeAllForEngagement(id_annual_engagement: number, options?: QueryOptions) {
    await this.query(options).delete(consultingEngagementCenterTable).where(eq(consultingEngagementCenterTable.id_annual_engagement, id_annual_engagement));
  }
}
