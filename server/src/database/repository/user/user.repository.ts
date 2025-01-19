import { Injectable, ConflictException } from "@nestjs/common";
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
    try {
      const result = await this.query()
        .insert(userTable)
        .values(createUserDTO);
      return result;
    } catch (error) {
      if ((error as any).code === '23505') { // Código de error para clave duplicada en PostgreSQL
        throw new ConflictException('Duplicate key value violates unique constraint');
      }
      throw error;
    }
  }

  async update(id: number, updateUserDTO: UpdateUserDTO) {
    try {
      const result = await this.query()
        .update(userTable)
        .set(updateUserDTO)
        .where(eq(userTable.id_user, id));
      return result;
    } catch (error) {
      if ((error as any).code === '23505') { // Código de error para clave duplicada en PostgreSQL
        throw new ConflictException('Duplicate key value violates unique constraint');
      }
      throw error;
    }
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
