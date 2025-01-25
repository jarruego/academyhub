import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserSelectModel, userTable } from "src/database/schema/tables/user.table";
import { eq, ilike, and } from "drizzle-orm";
import { CreateUserDTO } from "src/dto/user/create-user.dto";
import { UpdateUserDTO } from "src/dto/user/update-user.dto";
import { MoodleUser } from "src/types/moodle/user";

@Injectable()
export class UserRepository extends Repository {
  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(userTable).where(eq(userTable.id_user, id));
    return rows?.[0];
  }

  async create(createUserDTO: CreateUserDTO) {
      const result = await this.query()
        .insert(userTable)
        .values(createUserDTO);
      return result;
  }

  async update(id: number, updateUserDTO: UpdateUserDTO) {
      const result = await this.query()
        .update(userTable)
        .set(updateUserDTO)
        .where(eq(userTable.id_user, id));
      return result;
  }

  async delete(id: number) {
    const result = await this.query()
      .delete(userTable)
      .where(eq(userTable.id_user, id));
    return result;
  }

  async findAll(filter: Partial<UserSelectModel>) {
        const where = [];

        if (filter.name) where.push(ilike(userTable.name, `%{filter.name}%`));
        if (filter.surname) where.push(ilike(userTable.surname, `%{filter.surname}%`));
        if (filter.email) where.push(ilike(userTable.email, `%{filter.email}%`));
        if (filter.moodle_username) where.push(ilike(userTable.moodle_username, `%{filter.moodle_username}%`));
        //if (filter.dni) where.push(ilike(userTable.dni, `%{filter.dni}%`));
        //if (filter.phone) where.push(ilike(userTable.phone, `%{filter.phone}%`));
        //if (filter.nss) where.push(ilike(userTable.nss, `%{filter.nss}%`));
        //if (filter.document_type) where.push(ilike(userTable.document_type, `%{filter.document_type}%`));
        
        return await this.query().select().from(userTable).where(and(...where));
  }

  async findByMoodleId(moodleId: number) {
    const rows = await this.query().select().from(userTable).where(eq(userTable.moodle_id, moodleId));
    return rows?.[0];
  }

  async upsertMoodleUser(moodleUser: MoodleUser, id_group: number) {
    const existingUser = await this.findByMoodleId(moodleUser.id);
    if (existingUser) {
      await this.update(existingUser.id_user, {
        name: moodleUser.firstname,
        surname: moodleUser.lastname,
        email: moodleUser.email,
        moodle_username: moodleUser.username,
        moodle_id: moodleUser.id
      });
    } else {
      await this.create({
        name: moodleUser.firstname,
        surname: moodleUser.lastname,
        email: moodleUser.email,
        moodle_username: moodleUser.username,
        moodle_id: moodleUser.id
      });
    }
  }
}