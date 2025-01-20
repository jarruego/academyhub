import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { CenterSelectModel, centerTable } from "src/database/schema/tables/center.table";
import { eq, ilike, and, sql } from "drizzle-orm"; 
import { CreateCenterDTO } from "src/dto/center/create-center.dto";
import { UpdateCenterDTO } from "src/dto/center/update-center.dto";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { CreateUserCenterDTO } from "src/dto/user-center/create-user-center.dto";

@Injectable()
export class CenterRepository extends Repository {
    
    async findById(id: number, options?: QueryOptions) {
        const rows = await this.query(options).select().from(centerTable).where(eq(centerTable.id_center, id));
        return rows?.[0];
    }

    async findAll(filter: Partial<CenterSelectModel>) {
        const where = [];

        if (filter.center_name) where.push(ilike(centerTable.center_name, `%${filter.center_name}%`));
        if (filter.contact_email) where.push(eq(centerTable.contact_email, filter.contact_email));
        if (filter.contact_person) where.push(ilike(centerTable.contact_person, `%${filter.contact_person}%`));
        if (filter.contact_phone) where.push(eq(centerTable.contact_phone, filter.contact_phone));
        if (filter.employer_number) where.push(eq(centerTable.employer_number, filter.employer_number));
        if (filter.id_company) where.push(eq(centerTable.id_company, filter.id_company));

        return await this.query().select().from(centerTable).where(and(...where));
    }

    async create(createCenterDTO: CreateCenterDTO) {
        const result = await this.query()
            .insert(centerTable)
            .values(createCenterDTO);
        return result;
    }

    async update(id: number, updateCenterDTO: UpdateCenterDTO) {
        const result = await this.query()
            .update(centerTable)
            .set(updateCenterDTO)
            .where(eq(centerTable.id_center, id));
        return result;
    }

    async addUserToCenter(createUserCenterDTO: CreateUserCenterDTO) {
        const result = await this.query()
            .insert(userCenterTable)
            .values(createUserCenterDTO);
        return result;
    }

    async findUsersInCenter(centerId: number) {
        const rows = await this.query()
            .select()
            .from(userCenterTable)
            .where(eq(userCenterTable.id_center, centerId));
        return rows;
    }
}