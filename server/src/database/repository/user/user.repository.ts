import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserInsertModel, UserSelectModel, userTable, UserUpdateModel } from "src/database/schema/tables/user.table";
import { eq, ilike, and } from "drizzle-orm";
import { MoodleUser } from "src/types/moodle/user";
import { userCourseTable } from "src/database/schema/tables/user_course.table";
import { userCourseMoodleRoleTable } from "src/database/schema/tables/user_course_moodle_role.table";

@Injectable()
export class UserRepository extends Repository {
  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(userTable).where(eq(userTable.id_user, id));
    return rows?.[0];
  }

  async create(data: UserInsertModel, options?: QueryOptions): Promise<{ insertId: number }> {
    const result = await this.query(options)
      .insert(userTable)
      .values(data)
      .returning({ insertId: userTable.id_user });
    return result[0];
  }

  async update(id: number, data: UserUpdateModel, options?: QueryOptions) {
      const result = await this.query(options)
        .update(userTable)
        .set(data)
        .where(eq(userTable.id_user, id));
      return result;
  }

  async delete(id: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(userTable)
      .where(eq(userTable.id_user, id));
    return result;
  }

  async findAll(filter: Partial<UserSelectModel>, options?: QueryOptions) {
        const where = [];

        if (filter.name) where.push(ilike(userTable.name, `%{filter.name}%`));
        if (filter.first_surname) where.push(ilike(userTable.first_surname, `%{filter.first_surname}%`));
        if (filter.second_surname) where.push(ilike(userTable.second_surname, `%{filter.second_surname}%`));
        if (filter.email) where.push(ilike(userTable.email, `%{filter.email}%`));
        if (filter.moodle_username) where.push(ilike(userTable.moodle_username, `%{filter.moodle_username}%`));
        if (filter.dni) where.push(ilike(userTable.dni, `%{filter.dni}%`));
        if (filter.phone) where.push(ilike(userTable.phone, `%{filter.phone}%`));
        if (filter.nss) where.push(ilike(userTable.nss, `%{filter.nss}%`));
        // if (filter.document_type) where.push(ilike(userTable.document_type, `%{filter.document_type}%`));
        if (filter.professional_category) where.push(ilike(userTable.professional_category, `%{filter.professional_category}%`));
        if (filter.education_level) where.push(ilike(userTable.education_level, `%{filter.education_level}%`));
        if (filter.postal_code) where.push(ilike(userTable.postal_code, `%{filter.postal_code}%`));
        if (filter.city) where.push(ilike(userTable.city, `%{filter.city}%`));
        if (filter.province) where.push(ilike(userTable.province, `%{filter.province}%`));
        if (filter.country) where.push(ilike(userTable.country, `%{filter.country}%`));
        if (filter.observations) where.push(ilike(userTable.observations, `%{filter.observations}%`));
        
        return await this.query(options).select().from(userTable).where(and(...where));
  }

  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(userTable).where(eq(userTable.moodle_id, moodleId));
    return rows?.[0];
  }

  async upsertMoodleUserByCourse(moodleUser: MoodleUser, id_course: number, options?: QueryOptions) {
    const existingUser = await this.findByMoodleId(moodleUser.id, options);
    const data = {
      name: moodleUser.firstname,
      first_surname: moodleUser.lastname,
      email: moodleUser.email,
      moodle_username: moodleUser.username,
      moodle_id: moodleUser.id,
    } as UserInsertModel;
    let userId: number;

    if (existingUser) {
      //TODO: as UserUpdateModel
      await this.update(existingUser.id_user, data, options);
      userId = existingUser.id_user;
    } else {
      const result = await this.create(data, options);
      userId = result.insertId;
    }

    // Actualizar la tabla user_course
    await this.query(options)
      .insert(userCourseTable)
      .values({ id_user: userId, id_course: id_course })
      .onConflictDoNothing();

    // TODO: optimize
    // Actualizar la tabla user_course_moodle_role
    for (const role of moodleUser.roles) {
      await this.query(options)
        .insert(userCourseMoodleRoleTable)
        .values({
          id_user: userId,
          id_course: id_course,
          id_role: role.roleid,
          role_shortname: role.shortname
        })
        .onConflictDoNothing();
    }
    return await this.findById(userId); // TODO: is necesary?
  }
}