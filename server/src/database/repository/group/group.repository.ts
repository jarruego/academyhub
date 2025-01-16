import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { groupTable } from "src/database/schema/tables/group.table";
import { eq, ilike } from "drizzle-orm";
import { CreateGroupDTO } from "src/dto/group/create-group.dto";
import { UpdateGroupDTO } from "src/dto/group/update-group.dto";

@Injectable()
export class GroupRepository extends Repository {
  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(groupTable).where(eq(groupTable.id_group, id));
    return rows?.[0];
  }

  async create(createGroupDTO: CreateGroupDTO) {
    const result = await this.query()
      .insert(groupTable)
      .values({
        ...createGroupDTO,
        start_date: new Date(createGroupDTO.start_date).toISOString(),
        end_date: new Date(createGroupDTO.end_date).toISOString(),
      });
    return result;
  }

  async update(id: number, updateGroupDTO: UpdateGroupDTO) {
    const result = await this.query()
      .update(groupTable)
      .set({
        ...updateGroupDTO,
        start_date: new Date(updateGroupDTO.start_date).toISOString(),
        end_date: new Date(updateGroupDTO.end_date).toISOString(),
      })
      .where(eq(groupTable.id_group, id));
    return result;
  }

  async findAll(query: any) {
    let queryBuilder = this.query().select().from(groupTable);
    for (const key in query) {
      if (query.hasOwnProperty(key)) {
        queryBuilder = (queryBuilder as any).where(ilike(groupTable[key], `%${query[key]}%`));
      }
    }
    return await queryBuilder;
  }
}
