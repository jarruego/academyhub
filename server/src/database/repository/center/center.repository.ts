import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { CenterInsertModel, CenterSelectModel, centerTable, CenterUpdateModel } from "src/database/schema/tables/center.table";
import { eq, ilike, and } from "drizzle-orm"; 
import { UserCenterInsertModel, userCenterTable, UserCenterUpdateModel } from "src/database/schema/tables/user_center.table";

@Injectable()
export class CenterRepository extends Repository {
    
    async findById(id: number, options?: QueryOptions) {
        const rows = await this.query(options).select().from(centerTable).where(eq(centerTable.id_center, id));
        return rows?.[0];
    }

    async findAll(filter: Partial<CenterSelectModel>, options?: QueryOptions) {
        const where = [];

        if (filter.center_name) where.push(ilike(centerTable.center_name, `%${filter.center_name}%`));
        if (filter.contact_email) where.push(eq(centerTable.contact_email, filter.contact_email));
        if (filter.contact_person) where.push(ilike(centerTable.contact_person, `%${filter.contact_person}%`));
        if (filter.contact_phone) where.push(eq(centerTable.contact_phone, filter.contact_phone));
        if (filter.employer_number) where.push(eq(centerTable.employer_number, filter.employer_number));
        if (filter.id_company) where.push(eq(centerTable.id_company, filter.id_company));

        return await this.query(options).select().from(centerTable).where(and(...where));
    }

    async create(data: CenterInsertModel, options?: QueryOptions) {
        const result = await this.query(options)
            .insert(centerTable)
            .values(data);
        return result;
    }

    async update(id: number, data: CenterUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(centerTable)
            .set(data)
            .where(eq(centerTable.id_center, id));
        return result;
    }

    async deleteById(id: number, options?: QueryOptions) {
        const result = await this.query(options)
            .delete(centerTable)
            .where(eq(centerTable.id_center, id));
        return result;
    }

    async addUserToCenter(data: UserCenterInsertModel, options?: QueryOptions) {
        const result = await this.query(options)
            .insert(userCenterTable)
            .values(data);
        return result;
    }

    async findByCompanyId(companyId: number, options?: QueryOptions) {
        const rows = await this.query(options).select().from(centerTable).where(eq(centerTable.id_company, companyId));
        return rows;
    }
}