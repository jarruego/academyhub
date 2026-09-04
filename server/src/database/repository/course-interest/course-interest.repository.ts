import { Injectable } from "@nestjs/common";
import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { authUserTable } from "src/database/schema/tables/auth_user.table";
import { catalogCourseTable } from "src/database/schema/tables/course.table";
import { courseInterestTable, CourseInterestInsertModel, CourseInterestUpdateModel } from "src/database/schema/tables/course_interest.table";
import { userTable } from "src/database/schema/tables/user.table";
import { InterestStatus, OPEN_INTEREST_STATUSES } from "src/types/course-interest/course-interest.enums";
import { QueryOptions, Repository } from "../repository";

export interface CourseInterestFilters {
  id_catalog_course?: number;
  status?: InterestStatus;
  assigned_to?: number;
}

@Injectable()
export class CourseInterestRepository extends Repository {
  private selectColumns() {
    return {
      ...getTableColumns(courseInterestTable),
      name: userTable.name,
      first_surname: userTable.first_surname,
      second_surname: userTable.second_surname,
      dni: userTable.dni,
      phone: userTable.phone,
      email: userTable.email,
      catalog_course_name: catalogCourseTable.name,
      assigned_to_username: authUserTable.username,
    };
  }

  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(this.selectColumns())
      .from(courseInterestTable)
      .innerJoin(userTable, eq(courseInterestTable.id_user, userTable.id_user))
      .innerJoin(catalogCourseTable, eq(courseInterestTable.id_catalog_course, catalogCourseTable.id_catalog_course))
      .leftJoin(authUserTable, eq(courseInterestTable.assigned_to, authUserTable.id));
  }

  async findByCatalogCourse(idCatalogCourse: number, options?: QueryOptions) {
    return this.baseQuery(options)
      .where(eq(courseInterestTable.id_catalog_course, idCatalogCourse))
      .orderBy(desc(courseInterestTable.interest_date));
  }

  async findAll(filters: CourseInterestFilters, options?: QueryOptions) {
    const conditions = [
      filters.id_catalog_course ? eq(courseInterestTable.id_catalog_course, filters.id_catalog_course) : undefined,
      filters.status ? eq(courseInterestTable.status, filters.status) : undefined,
      filters.assigned_to ? eq(courseInterestTable.assigned_to, filters.assigned_to) : undefined,
    ].filter(Boolean);
    return this.baseQuery(options)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(courseInterestTable.interest_date));
  }

  async findById(id: number, options?: QueryOptions) {
    const [row] = await this.query(options).select().from(courseInterestTable).where(eq(courseInterestTable.id_interest, id));
    return row;
  }

  async findManyByIds(ids: number[], options?: QueryOptions) {
    if (!ids.length) return [];
    return this.query(options).select().from(courseInterestTable).where(inArray(courseInterestTable.id_interest, ids));
  }

  async findOpenByUserAndCatalogCourse(idUser: number, idCatalogCourse: number, options?: QueryOptions) {
    const [row] = await this.query(options)
      .select()
      .from(courseInterestTable)
      .where(and(
        eq(courseInterestTable.id_user, idUser),
        eq(courseInterestTable.id_catalog_course, idCatalogCourse),
        inArray(courseInterestTable.status, OPEN_INTEREST_STATUSES),
      ))
      .orderBy(desc(courseInterestTable.interest_date));
    return row;
  }

  async create(data: CourseInterestInsertModel, options?: QueryOptions) {
    const [row] = await this.query(options).insert(courseInterestTable).values(data).returning();
    return row;
  }

  async update(id: number, data: CourseInterestUpdateModel, options?: QueryOptions) {
    const [row] = await this.query(options)
      .update(courseInterestTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courseInterestTable.id_interest, id))
      .returning();
    return row;
  }

  async delete(id: number, options?: QueryOptions) {
    const [row] = await this.query(options).delete(courseInterestTable).where(eq(courseInterestTable.id_interest, id)).returning();
    return row;
  }
}
