import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { companyTable } from "src/database/schema/tables/company.table";
import { eq, like, ilike } from "drizzle-orm";
import { CreateCompanyDTO } from "src/dto/company/create-company.dto";
import { UpdateCompanyDTO } from "src/dto/company/update-company.dto";

@Injectable()
export class CompanyRepository extends Repository {
    
    async findByCIF(cif: string, options?: QueryOptions) {
        const rows = await this.query(options).select().from(companyTable).where(eq(companyTable.cif, cif));
        return rows?.[0];
    }

    async create(createCompanyDTO: CreateCompanyDTO) {
        const result = await this.query()
            .insert(companyTable)
            .values(createCompanyDTO);
        return result;
    }

    async update(id: number, updateCompanyDTO: UpdateCompanyDTO) {
        const result = await this.query()
            .update(companyTable)
            .set(updateCompanyDTO)
            .where(eq(companyTable.id_company, id));
        return result;
    }

    async findOne(id: number) {
        const rows = await this.query().select().from(companyTable).where(eq(companyTable.id_company, id));
        return rows?.[0];
    }

    async findAll(query: any) {
        let queryBuilder = this.query().select().from(companyTable);
        for (const key in query) {
            if (query.hasOwnProperty(key)) {
                queryBuilder = (queryBuilder as any).where(ilike(companyTable[key], `%${query[key]}%`));
            }
        }
        return await queryBuilder;
    }
}