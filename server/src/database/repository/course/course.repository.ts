import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { courseTable } from "src/database/schema/tables/course.table";
import { eq, ilike } from "drizzle-orm";
import { CreateCourseDTO } from "src/dto/course/create-course.dto";
import { UpdateCourseDTO } from "src/dto/course/update-course.dto";

@Injectable()
export class CourseRepository extends Repository {

  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(courseTable).where(eq(courseTable.id_course, id));
    return rows?.[0];
  }

  async create(createCourseDTO: CreateCourseDTO) {
    const result = await this.query()
      .insert(courseTable)
      .values({
        ...createCourseDTO,
        start_date: new Date(createCourseDTO.start_date).toISOString(),
        end_date: new Date(createCourseDTO.end_date).toISOString(),
        price_per_hour: createCourseDTO.price_per_hour.toString(),
      });
    return result;
  }

  async update(id: number, updateCourseDTO: UpdateCourseDTO) {
    const result = await this.query()
      .update(courseTable)
      .set({
        ...updateCourseDTO,
        start_date: new Date(updateCourseDTO.start_date).toISOString(),
        end_date: new Date(updateCourseDTO.end_date).toISOString(),
        price_per_hour: updateCourseDTO.price_per_hour.toString(),
      })
      .where(eq(courseTable.id_course, id));
    return result;
  }

  async findAll(query: any) {
    let queryBuilder = this.query().select().from(courseTable);
    for (const key in query) {
      if (query.hasOwnProperty(key)) {
        queryBuilder = (queryBuilder as any).where(ilike(courseTable[key], `%${query[key]}%`));
      }
    }
    return await queryBuilder;
  }
}