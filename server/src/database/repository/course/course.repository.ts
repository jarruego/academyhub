import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { CourseInsertModel, CourseSelectModel, courseTable, CourseUpdateModel } from "src/database/schema/tables/course.table";
import { eq, ilike, and } from "drizzle-orm";
import { userCourseMoodleRoleTable, UserCourseRoleInsertModel } from "src/database/schema/tables/user_course_moodle_role.table";

@Injectable()
export class CourseRepository extends Repository {

  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(courseTable).where(eq(courseTable.id_course, id));
    return rows?.[0];
  }

  async create(data: CourseInsertModel, options?: QueryOptions) {
    const result = await this.query(options)
      .insert(courseTable)
      .values(data).returning({id: courseTable.id_course});
    return result;
  }

  async update(id: number, data: CourseUpdateModel, options?: QueryOptions) {
    const result = await this.query(options)
      .update(courseTable)
      .set(data)
      .where(eq(courseTable.id_course, id));
    return result;
  }

  async findAll(filter: Partial<CourseSelectModel>, options?: QueryOptions) {
        const where = [];

        if (filter.course_name) where.push(ilike(courseTable.course_name, `%${filter.course_name}%`));
        if (filter.short_name) where.push(ilike(courseTable.short_name, `%${filter.short_name}%`));
        if (filter.category) where.push(ilike(courseTable.category, `%${filter.category}%`));
        if (filter.start_date) where.push(eq(courseTable.start_date, filter.start_date));
        if (filter.end_date) where.push(eq(courseTable.end_date, filter.end_date));
        // if (filter.price_per_hour) where.push(eq(courseTable.price_per_hour, filter.price_per_hour));
        if (filter.modality) where.push(eq(courseTable.modality, filter.modality));
        if (filter.active) where.push(eq(courseTable.active, filter.active));

        return await this.query(options).select().from(courseTable).where(and(...where));
  }

  async deleteById(id: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(courseTable)
      .where(eq(courseTable.id_course, id));
    return result;
  }

  async addUserRoleToCourse(userCourseRoleInsertModel: UserCourseRoleInsertModel, options?: QueryOptions) {
    const result = await this.query(options)
      .insert(userCourseMoodleRoleTable)
      .values(userCourseRoleInsertModel);
    return result;
  }

  //TODO: mejorar, se usa ¿UserCourseRoleInsertModel? para roles
  async updateUserRolesInCourse(id_course: number, id_user: number, roles: UserCourseRoleInsertModel[], options?: QueryOptions) {
    await this.query(options)
      .delete(userCourseMoodleRoleTable)
      .where(and(eq(userCourseMoodleRoleTable.id_course, id_course), eq(userCourseMoodleRoleTable.id_user, id_user)));

    const result = await this.query(options)
      .insert(userCourseMoodleRoleTable)
      .values(roles);
    return result;
  }

  async findByMoodleId(moodleId: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(courseTable).where(eq(courseTable.moodle_id, moodleId));
    return rows?.[0];
  }
}