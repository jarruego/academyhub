import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { Repository, QueryOptions } from "../repository";
import { courseRequestTable } from "src/database/schema/tables/course_request.table";
import { courseRequestStudentTable } from "src/database/schema/tables/course_request_student.table";
import { centerTable } from "src/database/schema/tables/center.table";
import { companyTable } from "src/database/schema/tables/company.table";
import { courseTable } from "src/database/schema/tables/course.table";
import { CourseRequestStatus } from "src/types/course-request/course-request-status.enum";
import {
  CourseRequestInsertModel,
  CourseRequestUpdateModel,
} from "src/database/schema/tables/course_request.table";

export type CourseRequestFilters = {
  id_course?: number;
  id_center?: number;
  id_company?: number;
  status?: CourseRequestStatus;
};

const HEADER_COLUMNS = {
  id_request: courseRequestTable.id_request,
  id_center: courseRequestTable.id_center,
  id_course: courseRequestTable.id_course,
  contact_email: courseRequestTable.contact_email,
  status: courseRequestTable.status,
  source: courseRequestTable.source,
  notes: courseRequestTable.notes,
  created_by: courseRequestTable.created_by,
  closed_at: courseRequestTable.closed_at,
  createdAt: courseRequestTable.createdAt,
  updatedAt: courseRequestTable.updatedAt,
  center_name: centerTable.center_name,
  center_contact_email: centerTable.contact_email,
  id_company: companyTable.id_company,
  company_name: companyTable.company_name,
  course_name: courseTable.course_name,
  student_count: sql<number>`(
    SELECT count(*) FROM course_request_students crs
    WHERE crs.id_request = ${courseRequestTable.id_request}
  )`.as("student_count"),
};

@Injectable()
export class CourseRequestRepository extends Repository {
  private baseQuery(options?: QueryOptions) {
    return this.query(options)
      .select(HEADER_COLUMNS)
      .from(courseRequestTable)
      .leftJoin(centerTable, eq(courseRequestTable.id_center, centerTable.id_center))
      .leftJoin(companyTable, eq(centerTable.id_company, companyTable.id_company))
      .innerJoin(courseTable, eq(courseRequestTable.id_course, courseTable.id_course));
  }

  private buildFilters(filters?: CourseRequestFilters) {
    const conditions = [];
    if (filters?.id_course) conditions.push(eq(courseRequestTable.id_course, filters.id_course));
    if (filters?.id_center) conditions.push(eq(courseRequestTable.id_center, filters.id_center));
    if (filters?.id_company) conditions.push(eq(companyTable.id_company, filters.id_company));
    if (filters?.status) conditions.push(eq(courseRequestTable.status, filters.status));
    return conditions.length ? and(...conditions) : undefined;
  }

  async create(data: CourseRequestInsertModel, options?: QueryOptions) {
    const rows = await this.query(options).insert(courseRequestTable).values(data).returning();
    return rows[0];
  }

  async update(id_request: number, data: CourseRequestUpdateModel, options?: QueryOptions) {
    const rows = await this.query(options)
      .update(courseRequestTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courseRequestTable.id_request, id_request))
      .returning();
    return rows[0];
  }

  async findById(id_request: number, options?: QueryOptions) {
    const rows = await this.baseQuery(options).where(eq(courseRequestTable.id_request, id_request));
    return rows[0];
  }

  async findAll(filters: CourseRequestFilters, options?: QueryOptions) {
    const where = this.buildFilters(filters);
    return this.baseQuery(options).where(where).orderBy(desc(courseRequestTable.createdAt));
  }

  async delete(id_request: number, options?: QueryOptions) {
    return this.query(options).delete(courseRequestTable).where(eq(courseRequestTable.id_request, id_request));
  }

  /** Peticiones y alumnos agrupados por curso, para el dashboard de listado. */
  async statsByCourse(options?: QueryOptions) {
    return this.query(options)
      .select({
        id_course: courseRequestTable.id_course,
        course_name: courseTable.course_name,
        request_count: count(courseRequestTable.id_request),
        student_count: sql<number>`(
          SELECT count(*) FROM course_request_students crs
          JOIN course_requests cr2 ON cr2.id_request = crs.id_request
          WHERE cr2.id_course = ${courseRequestTable.id_course}
        )`,
      })
      .from(courseRequestTable)
      .innerJoin(courseTable, eq(courseRequestTable.id_course, courseTable.id_course))
      .groupBy(courseRequestTable.id_course, courseTable.course_name);
  }

  /** Peticiones y alumnos agrupados por centro/empresa, para el dashboard de listado. */
  async statsByCenter(options?: QueryOptions) {
    return this.query(options)
      .select({
        id_center: courseRequestTable.id_center,
        center_name: centerTable.center_name,
        company_name: companyTable.company_name,
        request_count: count(courseRequestTable.id_request),
        student_count: sql<number>`(
          SELECT count(*) FROM course_request_students crs
          JOIN course_requests cr2 ON cr2.id_request = crs.id_request
          WHERE cr2.id_center IS NOT DISTINCT FROM ${courseRequestTable.id_center}
        )`,
      })
      .from(courseRequestTable)
      .leftJoin(centerTable, eq(courseRequestTable.id_center, centerTable.id_center))
      .leftJoin(companyTable, eq(centerTable.id_company, companyTable.id_company))
      .groupBy(courseRequestTable.id_center, centerTable.center_name, companyTable.company_name);
  }

  /**
   * Filas del informe "qué cursos ha pedido cada empresa, con alumnos por centro":
   * una fila por combinación empresa/centro/curso, filtrable por cualquiera de
   * los tres (o su combinación). Usada tanto para la vista en pantalla como para
   * el PDF (que agrupa estas filas empresa -> curso -> centro).
   */
  async reportRows(filters: CourseRequestFilters, options?: QueryOptions) {
    const conditions = [];
    if (filters.id_course) conditions.push(eq(courseRequestTable.id_course, filters.id_course));
    if (filters.id_center) conditions.push(eq(courseRequestTable.id_center, filters.id_center));
    if (filters.id_company) conditions.push(eq(companyTable.id_company, filters.id_company));
    const where = conditions.length ? and(...conditions) : undefined;

    return this.query(options)
      .select({
        id_company: companyTable.id_company,
        company_name: companyTable.company_name,
        id_center: courseRequestTable.id_center,
        center_name: centerTable.center_name,
        id_course: courseRequestTable.id_course,
        course_name: courseTable.course_name,
        request_count: sql<number>`count(distinct ${courseRequestTable.id_request})`,
        student_count: count(courseRequestStudentTable.id),
      })
      .from(courseRequestTable)
      .innerJoin(courseTable, eq(courseRequestTable.id_course, courseTable.id_course))
      .leftJoin(centerTable, eq(courseRequestTable.id_center, centerTable.id_center))
      .leftJoin(companyTable, eq(centerTable.id_company, companyTable.id_company))
      .leftJoin(courseRequestStudentTable, eq(courseRequestStudentTable.id_request, courseRequestTable.id_request))
      .where(where)
      .groupBy(
        companyTable.id_company,
        companyTable.company_name,
        courseRequestTable.id_center,
        centerTable.center_name,
        courseRequestTable.id_course,
        courseTable.course_name,
      )
      .orderBy(companyTable.company_name, courseTable.course_name, centerTable.center_name);
  }
}

@Injectable()
export class CourseRequestStudentRepository extends Repository {
  async findByRequest(id_request: number, options?: QueryOptions) {
    return this.query(options)
      .select()
      .from(courseRequestStudentTable)
      .where(eq(courseRequestStudentTable.id_request, id_request))
      .orderBy(courseRequestStudentTable.row_order, courseRequestStudentTable.id);
  }

  /** Sustituye todas las filas de la petición (guardado desde la grid). */
  async replaceAll(
    id_request: number,
    rows: Array<{
      name: string;
      first_surname: string;
      second_surname?: string | null;
      dni: string;
      email: string;
      phone_mobile?: string | null;
    }>,
    options?: QueryOptions,
  ) {
    await this.query(options)
      .delete(courseRequestStudentTable)
      .where(eq(courseRequestStudentTable.id_request, id_request));
    if (!rows.length) return [];
    return this.query(options)
      .insert(courseRequestStudentTable)
      .values(rows.map((row, index) => ({ ...row, id_request, row_order: index })))
      .returning();
  }

  /** Añade filas al final (alta desde Excel), conservando las ya guardadas. */
  async appendRows(
    id_request: number,
    rows: Array<{
      name: string;
      first_surname: string;
      second_surname?: string | null;
      dni: string;
      email: string;
      phone_mobile?: string | null;
    }>,
    options?: QueryOptions,
  ) {
    if (!rows.length) return [];
    const existing = await this.query(options)
      .select({ value: count() })
      .from(courseRequestStudentTable)
      .where(eq(courseRequestStudentTable.id_request, id_request));
    const startOrder = Number(existing[0]?.value ?? 0);
    return this.query(options)
      .insert(courseRequestStudentTable)
      .values(rows.map((row, index) => ({ ...row, id_request, row_order: startOrder + index })))
      .returning();
  }
}
