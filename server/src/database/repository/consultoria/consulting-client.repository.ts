import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingClientTable,
  consultingClientCompanyTable,
  ConsultingClientInsertModel,
  ConsultingClientUpdateModel,
} from "src/database/schema/tables/consulting_client.table";
import { companyTable } from "src/database/schema/tables/company.table";

@Injectable()
export class ConsultingClientRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options).select().from(consultingClientTable);
  }

  async create(data: ConsultingClientInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(consultingClientTable).values(data).returning();
    return rows[0];
  }

  async update(id_consulting_client: number, data: ConsultingClientUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(consultingClientTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultingClientTable.id_consulting_client, id_consulting_client))
      .returning();
    return rows[0];
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(consultingClientTable.name);
  }

  async findById(id_consulting_client: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingClientTable.id_consulting_client, id_consulting_client));
    return rows[0];
  }
}

@Injectable()
export class ConsultingClientCompanyRepository extends Repository {
  async findByClientId(id_consulting_client: number, options?: QueryOptions) {
    return this.query(options)
      .select({
        id_consulting_client_company: consultingClientCompanyTable.id_consulting_client_company,
        id_company: companyTable.id_company,
        company_name: companyTable.company_name,
        corporate_name: companyTable.corporate_name,
        cif: companyTable.cif,
      })
      .from(consultingClientCompanyTable)
      .innerJoin(companyTable, eq(consultingClientCompanyTable.id_company, companyTable.id_company))
      .where(eq(consultingClientCompanyTable.id_consulting_client, id_consulting_client))
      .orderBy(companyTable.company_name);
  }

  async findLink(id_consulting_client: number, id_company: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .select()
      .from(consultingClientCompanyTable)
      .where(and(
        eq(consultingClientCompanyTable.id_consulting_client, id_consulting_client),
        eq(consultingClientCompanyTable.id_company, id_company),
      ));
    return rows[0];
  }

  async addCompany(id_consulting_client: number, id_company: number, options?: QueryOptions) {
    const rows = await this.query(options)
      .insert(consultingClientCompanyTable)
      .values({ id_consulting_client, id_company })
      .returning();
    return rows[0];
  }

  async removeCompany(id_consulting_client: number, id_company: number, options?: QueryOptions) {
    await this.query(options)
      .delete(consultingClientCompanyTable)
      .where(and(
        eq(consultingClientCompanyTable.id_consulting_client, id_consulting_client),
        eq(consultingClientCompanyTable.id_company, id_company),
      ));
  }
}
