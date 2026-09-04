import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CatalogCourseRepository } from "src/database/repository/course/catalog-course.repository";
import { CreateCatalogCourseDto } from "./dto/create-catalog-course.dto";
import { UpdateCatalogCourseDto } from "./dto/update-catalog-course.dto";
import { catalogCourseTable, courseTable } from "src/database/schema/tables/course.table";
import { courseInterestTable } from "src/database/schema/tables/course_interest.table";
import { eq } from "drizzle-orm";

@Injectable()
export class CourseCatalogService {
  constructor(private readonly repository: CatalogCourseRepository) {}

  findAll(search?: string) {
    return this.repository.findAll(search?.trim() || undefined);
  }

  async findById(id: number) {
    const course = await this.repository.findById(id);
    if (!course) throw new NotFoundException("Curso de catálogo no encontrado.");
    return { ...course, editions: await this.repository.findEditions(id) };
  }

  async create(dto: CreateCatalogCourseDto) {
    try {
      return await this.repository.create(this.clean(dto));
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        throw new ConflictException("Ya existe un curso de catálogo con ese nombre o código interno.");
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateCatalogCourseDto) {
    await this.findById(id);
    try {
      return await this.repository.update(id, this.clean(dto));
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        throw new ConflictException("Ya existe un curso de catálogo con ese nombre o código interno.");
      }
      throw error;
    }
  }

  async merge(sourceId: number, targetId: number) {
    if (sourceId === targetId) throw new ConflictException("El curso de origen y destino deben ser distintos.");
    return this.repository.transaction(async (transaction) => {
      const source = await this.repository.findById(sourceId, { transaction });
      const target = await this.repository.findById(targetId, { transaction });
      if (!source || !target) throw new NotFoundException("Curso de catálogo no encontrado.");
      await transaction
        .update(courseTable)
        .set({ id_catalog_course: targetId })
        .where(eq(courseTable.id_catalog_course, sourceId));
      // Los intereses (fase 3) del curso de catálogo origen se trasladan
      // también: si no, la fila `catalog_courses` de origen no podría
      // borrarse (FK) y la bolsa de interesados del curso fusionado se
      // perdería de vista.
      await transaction
        .update(courseInterestTable)
        .set({ id_catalog_course: targetId })
        .where(eq(courseInterestTable.id_catalog_course, sourceId));
      await transaction
        .delete(catalogCourseTable)
        .where(eq(catalogCourseTable.id_catalog_course, sourceId));
      return { ...target, editions: await this.repository.findEditions(targetId, { transaction }) };
    });
  }

  private clean<T extends object>(dto: T): T {
    return Object.fromEntries(Object.entries(dto).map(([key, value]) => [
      key,
      typeof value === "string" ? (value.trim() || null) : value,
    ])) as T;
  }
}
