import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { CompanyInsertModel, CompanySelectModel, companyTable, CompanyUpdateModel } from "src/database/schema/tables/company.table";
import { eq, ilike, and } from "drizzle-orm";
import { DbCondition } from "src/database/types/db-expression";

@Injectable()
export class CompanyRepository extends Repository {
    
    async findByCIF(cif: string, options?: QueryOptions) {
        const rows = await this.query(options).select().from(companyTable).where(eq(companyTable.cif, cif));
        return rows?.[0];
    }

    async create(data: CompanyInsertModel, options?: QueryOptions) {
        const result = await this.query(options)
            .insert(companyTable)
            .values(data);
        return result;
    }

    async update(id: number, data: CompanyUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(companyTable)
            .set(data)
            .where(eq(companyTable.id_company, id));
        return result;
    }

    async findOne(id: number, options?: QueryOptions) {
        const rows = await this.query(options).select().from(companyTable).where(eq(companyTable.id_company, id));
        return rows?.[0];
    }

    async findAll(filter: Partial<CompanySelectModel>, options?: QueryOptions) {
        
    const where: DbCondition[] = [];

        if (filter.cif) where.push(ilike(companyTable.cif, `%${filter.cif}%`));
        if (filter.company_name) where.push(ilike(companyTable.company_name, `%${filter.company_name}%`));
        if (filter.corporate_name) where.push(ilike(companyTable.corporate_name, `%${filter.corporate_name}%`));
        if (filter.import_id) where.push(eq(companyTable.import_id, filter.import_id));

        return await this.query(options).select().from(companyTable).where(and(...where));
        

    }

    async delete(id: number, options?: QueryOptions) {
        const result = await this.query(options)
            .delete(companyTable)
            .where(eq(companyTable.id_company, id));
        return result;
    }
}