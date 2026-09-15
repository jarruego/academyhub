import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  courseCategoryTable,
  CourseCategoryInsertModel,
  CourseCategoryUpdateModel,
} from "src/database/schema/tables/course_category.table";

@Injectable()
export class CourseCategoryRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options).select().from(courseCategoryTable);
  }

  async create(data: CourseCategoryInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(courseCategoryTable).values(data).returning();
    return rows[0];
  }

  async update(id_category: number, data: CourseCategoryUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(courseCategoryTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courseCategoryTable.id_category, id_category))
      .returning();
    return rows[0];
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(courseCategoryTable.display_order, courseCategoryTable.name);
  }

  async findById(id_category: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(courseCategoryTable.id_category, id_category));
    return rows[0];
  }
}
