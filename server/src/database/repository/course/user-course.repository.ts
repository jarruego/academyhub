import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserCourseInsertModel, userCourseTable, UserCourseUpdateModel, UserCourseSelectModel } from "src/database/schema/tables/user_course.table";
import { courseTable, CourseSelectModel } from "src/database/schema/tables/course.table";
import { and, eq, sql, desc } from "drizzle-orm";
import type { InsertResult } from 'src/database/types/insert-result';

// Tipo para el resultado del JOIN usando los tipos base de Drizzle
export type UserCourseWithCourse = UserCourseSelectModel & {
    course: CourseSelectModel;
};

@Injectable()
export class UserCourseRepository extends Repository {
    async create(data: UserCourseInsertModel, options?: QueryOptions): Promise<InsertResult> {
        const result = await this.query(options).insert(userCourseTable).values(data).returning({ insertId: userCourseTable.id_user });
        return result?.[0] ?? {};
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
            .values(data)
            .onConflictDoUpdate({
                target: [userCourseTable.id_user, userCourseTable.id_course],
                set: {
                    id_moodle_user: data.id_moodle_user,
                    completion_percentage: data.completion_percentage,
                    enrollment_date: data.enrollment_date,
                    time_spent: data.time_spent,
                }
            });
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

    async findCoursesByUserId(userId: number, options?: QueryOptions): Promise<UserCourseWithCourse[]> {
        return await this.query(options)
            .select({
                // Todos los campos de UserCourse
                id_user: userCourseTable.id_user,
                id_course: userCourseTable.id_course,
                id_moodle_user: userCourseTable.id_moodle_user,
                enrollment_date: userCourseTable.enrollment_date,
                completion_percentage: userCourseTable.completion_percentage,
                time_spent: userCourseTable.time_spent,
                    // Course anidado usando el tipo CourseSelectModel
                course: {
                    id_course: courseTable.id_course,
                    moodle_id: courseTable.moodle_id,
                    course_name: courseTable.course_name,
                    category: courseTable.category,
                    short_name: courseTable.short_name,
                    start_date: courseTable.start_date,
                    end_date: courseTable.end_date,
                    modality: courseTable.modality,
                    hours: courseTable.hours,
                    price_per_hour: courseTable.price_per_hour,
                    active: sql<boolean>`CASE WHEN ${courseTable.end_date} > NOW() THEN true ELSE false END`, // Calcular basado en end_date
                    fundae_id: courseTable.fundae_id,
                    createdAt: courseTable.createdAt,
                    updatedAt: courseTable.updatedAt,
                }
            })
            .from(userCourseTable)
            .innerJoin(courseTable, eq(userCourseTable.id_course, courseTable.id_course))
            .where(eq(userCourseTable.id_user, userId))
            .orderBy(desc(courseTable.end_date));
    }

    /**
     * Buscar cursos asociados a un usuario de Moodle (id_moodle_user)
     */
    async findCoursesByMoodleUserId(moodleUserId: number, options?: QueryOptions): Promise<UserCourseWithCourse[]> {
        return await this.query(options)
            .select({
                id_user: userCourseTable.id_user,
                id_course: userCourseTable.id_course,
                id_moodle_user: userCourseTable.id_moodle_user,
                enrollment_date: userCourseTable.enrollment_date,
                completion_percentage: userCourseTable.completion_percentage,
                time_spent: userCourseTable.time_spent,
                course: {
                    id_course: courseTable.id_course,
                    moodle_id: courseTable.moodle_id,
                    course_name: courseTable.course_name,
                    category: courseTable.category,
                    short_name: courseTable.short_name,
                    start_date: courseTable.start_date,
                    end_date: courseTable.end_date,
                    modality: courseTable.modality,
                    hours: courseTable.hours,
                    price_per_hour: courseTable.price_per_hour,
                    active: sql<boolean>`CASE WHEN ${courseTable.end_date} > NOW() THEN true ELSE false END`,
                    fundae_id: courseTable.fundae_id,
                    createdAt: courseTable.createdAt,
                    updatedAt: courseTable.updatedAt,
                }
            })
            .from(userCourseTable)
            .innerJoin(courseTable, eq(userCourseTable.id_course, courseTable.id_course))
            .where(eq(userCourseTable.id_moodle_user, moodleUserId))
            .orderBy(desc(courseTable.end_date));
    }
}