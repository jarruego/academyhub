import { Injectable } from "@nestjs/common";
import { asc, count, eq, ilike, or } from "drizzle-orm";
import {
  catalogCourseTable,
  CatalogCourseInsertModel,
  CatalogCourseUpdateModel,
  courseTable,
} from "src/database/schema/tables/course.table";
import { normalizeCourseCatalogName } from "src/utils/course-catalog-name.util";
import { QueryOptions, Repository } from "../repository";

@Injectable()
export class CatalogCourseRepository extends Repository {
  async findAll(search?: string, options?: QueryOptions) {
    const where = search
      ? or(
          ilike(catalogCourseTable.name, `%${search}%`),
          ilike(catalogCourseTable.internal_code, `%${search}%`),
          ilike(catalogCourseTable.sepe_specialty_code, `%${search}%`),
        )
      : undefined;
    const rows = await this.query(options)
      .select({
        id_catalog_course: catalogCourseTable.id_catalog_course,
        name: catalogCourseTable.name,
        normalized_name: catalogCourseTable.normalized_name,
        internal_code: catalogCourseTable.internal_code,
        description: catalogCourseTable.description,
        objectives: catalogCourseTable.objectives,
        base_contents: catalogCourseTable.base_contents,
        contents: catalogCourseTable.contents,
        default_modality: catalogCourseTable.default_modality,
        default_hours: catalogCourseTable.default_hours,
        sepe_specialty_code: catalogCourseTable.sepe_specialty_code,
        sepe_specialty_name: catalogCourseTable.sepe_specialty_name,
        professional_family: catalogCourseTable.professional_family,
        professional_area: catalogCourseTable.professional_area,
        createdAt: catalogCourseTable.createdAt,
        updatedAt: catalogCourseTable.updatedAt,
        editions_count: count(courseTable.id_course),
      })
      .from(catalogCourseTable)
      .leftJoin(courseTable, eq(courseTable.id_catalog_course, catalogCourseTable.id_catalog_course))
      .where(where)
      .groupBy(catalogCourseTable.id_catalog_course)
      .orderBy(asc(catalogCourseTable.name));
    return rows.map((row) => ({ ...row, editions_count: Number(row.editions_count) }));
  }

  async findById(id: number, options?: QueryOptions) {
    const [row] = await this.query(options)
      .select()
      .from(catalogCourseTable)
      .where(eq(catalogCourseTable.id_catalog_course, id));
    return row;
  }

  async findByNormalizedName(normalizedName: string, options?: QueryOptions) {
    const [row] = await this.query(options)
      .select()
      .from(catalogCourseTable)
      .where(eq(catalogCourseTable.normalized_name, normalizedName));
    return row;
  }

  async create(data: Omit<CatalogCourseInsertModel, "normalized_name">, options?: QueryOptions) {
    const [row] = await this.query(options)
      .insert(catalogCourseTable)
      .values({ ...data, normalized_name: normalizeCourseCatalogName(data.name) })
      .returning();
    return row;
  }

  async update(id: number, data: CatalogCourseUpdateModel, options?: QueryOptions) {
    const patch = data.name
      ? { ...data, normalized_name: normalizeCourseCatalogName(data.name) }
      : data;
    const [row] = await this.query(options)
      .update(catalogCourseTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(catalogCourseTable.id_catalog_course, id))
      .returning();
    return row;
  }

  async ensurePendingByName(name: string, options?: QueryOptions) {
    const normalizedName = normalizeCourseCatalogName(name);
    const existing = await this.findByNormalizedName(normalizedName, options);
    if (existing) return existing;
    const [row] = await this.query(options)
      .insert(catalogCourseTable)
      .values({ name: name.trim(), normalized_name: normalizedName })
      .onConflictDoNothing({ target: catalogCourseTable.normalized_name })
      .returning();
    return row ?? this.findByNormalizedName(normalizedName, options);
  }

  async findEditions(id: number, options?: QueryOptions) {
    return this.query(options)
      .select()
      .from(courseTable)
      .where(eq(courseTable.id_catalog_course, id));
  }
}
