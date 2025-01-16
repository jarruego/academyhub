import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { userTable } from "src/database/schema/tables/user.table";
import { eq, ilike } from "drizzle-orm";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";

@Injectable()
export class UserRepository extends Repository {
  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(userTable).where(eq(userTable.id_user, id));
    return rows?.[0];
  }

  async create(createUserDTO: CreateUserDTO) {
    const result = await this.query()
      .insert(userTable)
      .values({
        ...createUserDTO,
        registration_date: new Date(createUserDTO.registration_date).toISOString()
      });
    return result;
  }

  async update(id: number, updateUserDTO: UpdateUserDTO) {
    const result = await this.query()
      .update(userTable)
      .set({
        ...updateUserDTO,
        registration_date: new Date(updateUserDTO.registration_date).toISOString()
      })
      .where(eq(userTable.id_user, id));
    return result;
  }

  async findAll(query: any) {
    let queryBuilder = this.query().select().from(userTable);
    for (const key in query) {
      if (query.hasOwnProperty(key)) {
        queryBuilder = (queryBuilder as any).where(ilike(userTable[key], `%${query[key]}%`));
      }
    }
    return await queryBuilder;
  }
}
