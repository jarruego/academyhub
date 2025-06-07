import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserCourseInsertModel, userCourseTable, UserCourseUpdateModel } from "src/database/schema/tables/user_course.table";
import { and, eq } from "drizzle-orm";

@Injectable()
export class UserCourseRepository extends Repository {
    async create(data: UserCourseInsertModel, options?: QueryOptions) {
        return await this.query(options).insert(userCourseTable).values(data);
    }

    async updateById(userId: number, courseId: number, data: UserCourseUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userCourseTable).set(data).where(and(eq(userCourseTable.id_user, userId), eq(userCourseTable.id_course, courseId)));
    }

    async findByCourseAndUserId(courseId: number, userId: number, options?: QueryOptions) {
        return (await this.query(options).select().from(userCourseTable).where(and(eq(userCourseTable.id_course, courseId), eq(userCourseTable.id_user, userId))).limit(1))?.[0] ?? null;
    }

    async addUserToCourse(data: UserCourseInsertModel, options?: QueryOptions) {
    const result = await this.query(options)
      .insert(userCourseTable)
      .values(data);
    return result;
  }

    async findUsersInCourse(courseId: number, options?: QueryOptions) {
        const rows = await this.query(options)
            .select()
            .from(userCourseTable)
            .where(eq(userCourseTable.id_course, courseId));
        return rows;
    }

    async updateUserInCourse(id_course: number, id_user: number, data: UserCourseUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(userCourseTable)
            .set(data)
            .where(and(eq(userCourseTable.id_course, id_course), eq(userCourseTable.id_user, id_user)));
        return result;
    }

    async deleteUserFromCourse(id_course: number, id_user: number, options?: QueryOptions) {
        const result = await this.query(options)
            .delete(userCourseTable)
            .where(and(eq(userCourseTable.id_course, id_course), eq(userCourseTable.id_user, id_user)));
        return result;
    }
}