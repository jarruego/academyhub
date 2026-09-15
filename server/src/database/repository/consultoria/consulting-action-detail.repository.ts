import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import {
  consultingActionDetailTable,
  ConsultingActionDetailInsertModel,
} from "src/database/schema/tables/consulting_action_detail.table";
import { catalogCourseTable } from "src/database/schema/tables/course.table";
import { courseCategoryTable } from "src/database/schema/tables/course_category.table";
import { consultingPlanningDateTable } from "src/database/schema/tables/consulting_planning_date.table";

const JOINED_COLUMNS = {
  id_catalog_course: consultingActionDetailTable.id_catalog_course,
  origin: consultingActionDetailTable.origin,
  id_category: consultingActionDetailTable.id_category,
  category_name: courseCategoryTable.name,
  id_planning_date: consultingActionDetailTable.id_planning_date,
  planning_date_name: consultingPlanningDateTable.name,
  created_by: consultingActionDetailTable.created_by,
  createdAt: consultingActionDetailTable.createdAt,
  updatedAt: consultingActionDetailTable.updatedAt,
  // Del curso de catálogo — no duplicados en esta tabla, ver docs/consultoria.md.
  name: catalogCourseTable.name,
  hours: catalogCourseTable.default_hours,
  modality: catalogCourseTable.default_modality,
  objectives: catalogCourseTable.objectives,
  target_audience: catalogCourseTable.target_audience,
};

@Injectable()
export class ConsultingActionDetailRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(JOINED_COLUMNS)
      .from(consultingActionDetailTable)
      .innerJoin(catalogCourseTable, eq(consultingActionDetailTable.id_catalog_course, catalogCourseTable.id_catalog_course))
      .leftJoin(courseCategoryTable, eq(consultingActionDetailTable.id_category, courseCategoryTable.id_category))
      .leftJoin(consultingPlanningDateTable, eq(consultingActionDetailTable.id_planning_date, consultingPlanningDateTable.id_planning_date));
  }

  async findAll(options?: QueryOptions) {
    return this.baseQuery(options).orderBy(catalogCourseTable.name);
  }

  async findByCatalogCourseId(id_catalog_course: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(consultingActionDetailTable.id_catalog_course, id_catalog_course));
    return rows[0];
  }

  /**
   * Alta o edición — id_catalog_course es la clave primaria, así que "dar de
   * alta" y "editar" son la misma operación. `created_by` no se toca en la
   * rama de edición: solo se fija al insertar, para no "robarle" la autoría a
   * quien etiquetó la acción la primera vez.
   */
  async upsert(id_catalog_course: number, data: Omit<ConsultingActionDetailInsertModel, 'id_catalog_course'>, options?: QueryOptions) {
    const { created_by, ...updatableFields } = data;
    await this.query(options)
      .insert(consultingActionDetailTable)
      .values({ id_catalog_course, ...data })
      .onConflictDoUpdate({
        target: consultingActionDetailTable.id_catalog_course,
        set: { ...updatableFields, updatedAt: new Date() },
      });
    return this.findByCatalogCourseId(id_catalog_course, options);
  }
}
