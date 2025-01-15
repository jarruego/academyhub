
import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { centerTable } from "src/database/schema/tables/center.table";
import { eq } from "drizzle-orm";
import { CreateCenterDTO } from "src/dto/center/create-center.dto";
import { UpdateCenterDTO } from "src/dto/center/update-center.dto";

@Injectable()
export class CenterRepository extends Repository {
    
    async findById(id: number, options?: QueryOptions) {
        const rows = await this.query(options).select().from(centerTable).where(eq(centerTable.id_center, id));
        return rows?.[0];
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
}