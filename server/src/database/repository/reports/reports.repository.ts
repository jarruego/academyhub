import { Injectable } from "@nestjs/common";
import { Repository, QueryOptions } from "../repository";
import { and, eq, sql, or, count, desc, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm/sql";
import type { PgColumn } from "drizzle-orm/pg-core";
import { userGroupTable } from "src/database/schema/tables/user_group.table";
import { userTable } from "src/database/schema/tables/user.table";
import { groupTable } from "src/database/schema/tables/group.table";
import { courseTable } from "src/database/schema/tables/course.table";
import { centers } from "src/database/schema";
import { companyTable } from "src/database/schema/tables/company.table";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { userCourseTable } from "src/database/schema/tables/user_course.table";
import { moodleUserTable } from "src/database/schema/tables/moodle_user.table";
import { userRolesTable } from "src/database/schema/tables/user_roles.table";
import { ReportFilterDTO } from "src/dto/reports/report-filter.dto";

// Dimensiones cuyo desplegable se calcula como faceta. Al recalcular las opciones
// de una dimensión se aplican todos los filtros EXCEPTO el de esa misma dimensión
// (facetas estándar: una multiselección no restringe sus propias opciones).
export type FacetDimension = 'company' | 'center' | 'course' | 'group' | 'role' | 'modality' | 'client' | 'funding';

@Injectable()
export class ReportsRepository extends Repository {
  /**
   * Construye las condiciones WHERE compartidas por el listado y por las facetas.
   * Si `exclude` está presente se omite el filtro de esa dimensión (para no
   * autorrestringir su propio desplegable). El resto de filtros (fechas, búsqueda,
   * % completado, bonificados) son globales y se aplican siempre.
   *
   * Método puro: solo construye expresiones SQL, no accede a la base de datos.
   */
  buildWhereConditions(filter?: ReportFilterDTO, exclude?: FacetDimension): SQL[] {
    const where: SQL[] = [];

    // support arrays for company/center filters (multiple selection)
    if (exclude !== 'company' && filter?.id_company) {
      if (Array.isArray(filter.id_company) && filter.id_company.length) {
        where.push(or(...filter.id_company.map((id) => eq(companyTable.id_company, Number(id)))));
      } else if (!Array.isArray(filter.id_company)) {
        where.push(eq(companyTable.id_company, filter.id_company));
      }
    }
    if (exclude !== 'center' && filter?.id_center) {
      if (Array.isArray(filter.id_center) && filter.id_center.length) {
        where.push(or(...filter.id_center.map((id) => eq(centers.id_center, Number(id)))));
      } else if (!Array.isArray(filter.id_center)) {
        where.push(eq(centers.id_center, filter.id_center));
      }
    }
    if (exclude !== 'course' && filter?.id_course) where.push(eq(courseTable.id_course, filter.id_course));
    // Support multiple selected groups (id_group can be number[])
    if (exclude !== 'group' && filter?.id_group) {
      if (Array.isArray(filter.id_group) && filter.id_group.length) {
        where.push(or(...filter.id_group.map((id) => eq(groupTable.id_group, Number(id)))));
      } else if (!Array.isArray(filter.id_group)) {
        where.push(eq(groupTable.id_group, filter.id_group as unknown as number));
      }
    }
    if (exclude !== 'role' && filter?.id_role) {
      if (Array.isArray(filter.id_role) && filter.id_role.length) {
        where.push(or(...filter.id_role.map((id) => eq(userGroupTable.id_role, Number(id)))));
      } else if (!Array.isArray(filter.id_role)) {
        where.push(eq(userGroupTable.id_role, filter.id_role as unknown as number));
      }
    }

    // Ejes de clasificación del curso (modalidad / cliente / financiación)
    if (exclude !== 'modality' && Array.isArray(filter?.modality) && filter.modality.length) {
      where.push(inArray(courseTable.modality, filter.modality));
    }
    if (exclude !== 'client' && Array.isArray(filter?.client) && filter.client.length) {
      where.push(inArray(courseTable.client, filter.client));
    }
    if (exclude !== 'funding' && Array.isArray(filter?.funding) && filter.funding.length) {
      where.push(inArray(courseTable.funding, filter.funding));
    }

    if (filter?.start_date) where.push(sql`${groupTable.start_date} >= ${filter.start_date}`);
    if (filter?.end_date) where.push(sql`${groupTable.end_date} <= ${filter.end_date}`);

    // Completion percentage threshold: return rows with completion >= provided value
    if (filter?.completion_percentage !== undefined && filter?.completion_percentage !== null) {
      where.push(sql`COALESCE(${userGroupTable.completion_percentage}, ${userCourseTable.completion_percentage}, 0) >= ${Number(filter.completion_percentage)}`);
    }

    // Sólo inscripciones marcadas como bonificadas en la última bonificación FUNDAE del grupo
    if (filter?.bonified) {
      where.push(eq(userGroupTable.bonified, true));
    }

    if (filter?.search) {
      const term = `%${String(filter.search).trim()}%`;
      // Search across multiple user fields: name, first/second surname, full name,
      // dni, email, phone and employer number (nss). Use unaccent+lower for
      // case- and accent-insensitive matching (Postgres unaccent extension).
      where.push(or(
        sql`unaccent(lower(${userTable.name})) LIKE unaccent(lower(${term}))`,
        sql`unaccent(lower(${userTable.first_surname})) LIKE unaccent(lower(${term}))`,
        sql`unaccent(lower(${userTable.second_surname})) LIKE unaccent(lower(${term}))`,
        // full name concatenation
        sql`unaccent(lower(${userTable.name} || ' ' || COALESCE(${userTable.first_surname}, '') || ' ' || COALESCE(${userTable.second_surname}, ''))) LIKE unaccent(lower(${term}))`,
        sql`unaccent(lower(${userTable.dni})) LIKE unaccent(lower(${term}))`,
        sql`unaccent(lower(${userTable.email})) LIKE unaccent(lower(${term}))`,
        sql`unaccent(lower(${userTable.phone})) LIKE unaccent(lower(${term}))`,
        sql`unaccent(lower(${centers.employer_number})) LIKE unaccent(lower(${term}))`,
      ));
    }

    return where;
  }

  /**
   * Devuelve, por cada dimensión-desplegable, los valores distintos que tienen al
   * menos una fila de informe compatible con el resto de filtros (facetas estándar).
   * Reutiliza exactamente los JOINs del listado para mantener la coherencia.
   * El desplegable de grupos solo se calcula cuando hay un curso seleccionado
   * (igual que en el cliente, para no devolver miles de grupos).
   */
  async getReportFacets(filter?: ReportFilterDTO, options?: QueryOptions) {
    // El builder se tipa como `any` internamente porque un genérico amplio en
    // `selectDistinct` rompe la inferencia del encadenado de joins en drizzle;
    // el shape concreto se reimpone con la aserción de cada faceta.
    const baseSelect = (cols: Record<string, PgColumn>, exclude: FacetDimension) => {
      const where = this.buildWhereConditions(filter, exclude);
      const cond = where.length > 0 ? and(...where) : undefined;
      return (this.query(options) as any)
        .selectDistinct(cols)
        .from(userGroupTable)
        .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
        .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
        .innerJoin(courseTable, eq(groupTable.id_course, courseTable.id_course))
        .leftJoin(userRolesTable, eq(userGroupTable.id_role, userRolesTable.id_role))
        .leftJoin(userCourseTable, and(eq(userCourseTable.id_user, userTable.id_user), eq(userCourseTable.id_course, courseTable.id_course)))
        .leftJoin(userCenterTable, and(eq(userCenterTable.id_user, userTable.id_user), eq(userCenterTable.is_main_center, true)))
        .leftJoin(centers, eq(userCenterTable.id_center, centers.id_center))
        .leftJoin(companyTable, eq(centers.id_company, companyTable.id_company))
        .where(cond);
    };

    const [companies, centersList, courses, groups, roles, modalities, clients, fundings] = await Promise.all([
      baseSelect({ id_company: companyTable.id_company, company_name: companyTable.company_name }, 'company').orderBy(companyTable.company_name) as Promise<{ id_company: number; company_name: string | null }[]>,
      baseSelect({ id_center: centers.id_center, center_name: centers.center_name }, 'center').orderBy(centers.center_name) as Promise<{ id_center: number; center_name: string | null }[]>,
      baseSelect({ id_course: courseTable.id_course, course_name: courseTable.course_name }, 'course').orderBy(courseTable.course_name) as Promise<{ id_course: number; course_name: string | null }[]>,
      (filter?.id_course
        ? baseSelect({ id_group: groupTable.id_group, group_name: groupTable.group_name }, 'group').orderBy(groupTable.group_name)
        : Promise.resolve([])) as Promise<{ id_group: number; group_name: string | null }[]>,
      baseSelect({ id_role: userRolesTable.id_role, role_shortname: userRolesTable.role_shortname }, 'role').orderBy(userRolesTable.role_shortname) as Promise<{ id_role: number; role_shortname: string | null }[]>,
      baseSelect({ value: courseTable.modality }, 'modality').orderBy(courseTable.modality) as Promise<{ value: string | null }[]>,
      baseSelect({ value: courseTable.client }, 'client').orderBy(courseTable.client) as Promise<{ value: string | null }[]>,
      baseSelect({ value: courseTable.funding }, 'funding').orderBy(courseTable.funding) as Promise<{ value: string | null }[]>,
    ]);

    const nonNull = (arr: { value: string | null }[]) => arr.map((r) => r.value).filter((v): v is string => v != null);

    // Los LEFT JOIN de centro/empresa/rol pueden producir filas con id nulo; se descartan.
    return {
      companies: companies.filter((c) => c.id_company != null),
      centers: centersList.filter((c) => c.id_center != null),
      courses,
      groups,
      roles: roles.filter((r) => r.id_role != null),
      modalities: nonNull(modalities),
      clients: nonNull(clients),
      fundings: nonNull(fundings),
    };
  }

  /**
   * Devuelve un listado plano con información cruzada por usuario/inscripción
   */
  async getReportRows(filter?: ReportFilterDTO, options?: QueryOptions) {
    const q = this.query(options);

    const page = Number(filter?.page) || 1;
    const limit = Number(filter?.limit) || 100;
    const offset = (page - 1) * limit;

    // Conditions for WHERE clause: Drizzle SQL expressions (shared with the facets endpoint)
    const where = this.buildWhereConditions(filter);

    const whereCondition = where.length > 0 ? and(...where) : undefined;

    // total count
    const totalResult = await q
      .select({ total: count() })
      .from(userGroupTable)
      .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
      .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
      .innerJoin(courseTable, eq(groupTable.id_course, courseTable.id_course))
      .leftJoin(userCourseTable, and(eq(userCourseTable.id_user, userTable.id_user), eq(userCourseTable.id_course, courseTable.id_course)))
      .leftJoin(userCenterTable, and(eq(userCenterTable.id_user, userTable.id_user), eq(userCenterTable.is_main_center, true)))
      .leftJoin(centers, eq(userCenterTable.id_center, centers.id_center))
      .leftJoin(companyTable, eq(centers.id_company, companyTable.id_company))
      .where(whereCondition);

    const total = Number(totalResult?.[0]?.total ?? 0);

    // Build order clause from requested sort field/order, but only allow known columns
    const sortableMap: Record<string, PgColumn> = {
      name: userTable.name,
      first_surname: userTable.first_surname,
      second_surname: userTable.second_surname,
      dni: userTable.dni,
      email: userTable.email,
      phone: userTable.phone,
      center_name: centers.center_name,
      employer_number: centers.employer_number,
      company_name: companyTable.company_name,
      company_cif: companyTable.cif,
      group_name: groupTable.group_name,
      group_start_date: groupTable.start_date,
      group_end_date: groupTable.end_date,
      role_shortname: userRolesTable.role_shortname,
      completion_percentage: userGroupTable.completion_percentage,
      time_spent: userCourseTable.time_spent,
      course_name: courseTable.course_name,
      moodle_id: moodleUserTable.moodle_id,
      moodle_username: moodleUserTable.moodle_username,
    };

    // Build order clause(s). For date columns, ensure NULLs are treated as "older"
    // (i.e. nulls are considered older than any real date). This means:
    // - when sorting DESC (newest first) nulls go last
    // - when sorting ASC (oldest first) nulls go first
    // Typed order clause: can hold PG-specific columns, SQL expressions or descending wrappers
    let orderClause: Array<PgColumn | SQL | ReturnType<typeof desc>> = [userTable.id_user as PgColumn];
    if (filter?.sort_field) {
      const col = sortableMap[String(filter.sort_field)];
      if (col) {
        // If the column is one of the group date columns, build a composite order
        // using a CASE expression to push nulls to the desired side.
        const isGroupDate = col === groupTable.start_date || col === groupTable.end_date;
        if (isGroupDate) {
          if (filter.sort_order === 'desc') {
            // nulls last: sort by (col IS NULL) so non-nulls (0) come first, then by value desc
            orderClause = [sql`CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END`, desc(col)];
          } else {
            // asc: nulls first: make nulls 0 so they come before real dates
            orderClause = [sql`CASE WHEN ${col} IS NULL THEN 0 ELSE 1 END`, col];
          }
        } else {
          orderClause = filter.sort_order === 'desc' ? [desc(col)] : [col];
        }
      }
    }

    const uniqueArr = await this.fetchMappedRows(whereCondition, { limit, offset, orderClause });

    return {
      data: uniqueArr,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Internal helper: run the common select+joins, map rows and deduplicate.
   */
  private async fetchMappedRows(whereCondition?: SQL, opts?: { limit?: number; offset?: number; orderClause?: Array<PgColumn | SQL | ReturnType<typeof desc>> }) {
    const q = this.query();
    const rows = await q
      .select({
        user: userTable,
        user_group: userGroupTable,
        group: groupTable,
        course: courseTable,
        center: centers,
        company: companyTable,
        user_course: userCourseTable,
        moodle_user: moodleUserTable,
        role: userRolesTable,
      })
      .from(userGroupTable)
      .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
      .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
      .innerJoin(courseTable, eq(groupTable.id_course, courseTable.id_course))
      .leftJoin(userRolesTable, eq(userGroupTable.id_role, userRolesTable.id_role))
      .leftJoin(userCourseTable, and(eq(userCourseTable.id_user, userTable.id_user), eq(userCourseTable.id_course, courseTable.id_course)))
      .leftJoin(moodleUserTable, and(eq(moodleUserTable.id_user, userTable.id_user), eq(moodleUserTable.is_main_user, true)))
      .leftJoin(userCenterTable, and(eq(userCenterTable.id_user, userTable.id_user), eq(userCenterTable.is_main_center, true)))
      .leftJoin(centers, eq(userCenterTable.id_center, centers.id_center))
      .leftJoin(companyTable, eq(centers.id_company, companyTable.id_company))
      .where(whereCondition)
      .orderBy(...(opts?.orderClause ?? []))
      .limit(opts?.limit ?? undefined)
      .offset(opts?.offset ?? undefined);

    const mapped = rows.map((r) => ({
      id_user: r.user?.id_user,
      id_group: r.user_group?.id_group,
      name: r.user?.name,
      first_surname: r.user?.first_surname,
      second_surname: r.user?.second_surname,
      dni: r.user?.dni,
      email: r.user?.email,
      phone: r.user?.phone,
      // include ids for center/company/course so the client can link to their detail pages
      id_center: r.center?.id_center ?? null,
      id_company: r.company?.id_company ?? null,
      id_course: r.course?.id_course ?? null,
      center_name: r.center?.center_name ?? null,
      employer_number: r.center?.employer_number ?? null,
      company_name: r.company?.company_name ?? null,
      company_cif: r.company?.cif ?? null,
      group_name: r.group?.group_name ?? null,
      group_start_date: r.group?.start_date ?? null,
      group_end_date: r.group?.end_date ?? null,
      role_shortname: r.role?.role_shortname ?? null,
      job_position: r.user?.job_position ?? null,
      gender: r.user?.gender ?? null,
      completion_percentage: r.user_group?.completion_percentage ?? r.user_course?.completion_percentage ?? null,
      time_spent: r.user_course?.time_spent ?? null,
      course_name: r.course?.course_name ?? null,
      hours: r.course?.hours ?? null,
      modality: r.course?.modality ?? null,
      moodle_id: r.moodle_user?.moodle_id ?? r.user_course?.id_moodle_user ?? null,
      course_moodle_id: r.course?.moodle_id ?? null,
      moodle_username: r.moodle_user?.moodle_username ?? null,
      moodle_password: r.moodle_user?.moodle_password ?? null,
    }));

    // Deduplicate rows that may repeat due to LEFT JOINs (user_course, moodle_user, etc.).
    const uniqueMap = new Map<string, (typeof mapped)[number]>();
    for (const r of mapped) {
      const key = (r.id_user != null && r.id_group != null)
        ? `${r.id_user}-${r.id_group}`
        : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, r);
    }
    return Array.from(uniqueMap.values());
  }

  /**
   * Fetch report rows matching an explicit list of row keys.
   * Keys are expected to be either "{id_user}-{id_group}" or "{dni}-{moodle_id}".
   */
  async getReportRowsByKeys(keys: string[]) {
    if (!keys || !keys.length) return [] as any;

    const q = this.query();

    const whereClauses: SQL[] = [];
    for (const k of keys) {
      const parts = String(k ?? '').split('-');
      if (parts.length === 2) {
        const [left, right] = parts;
        const leftNum = Number(left);
        const rightNum = Number(right);
        if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
          // numeric composite key: id_user-id_group
          whereClauses.push(and(eq(userTable.id_user, leftNum), eq(userGroupTable.id_group, rightNum)));
        } else {
          // fallback: dni-moodleId (strings) - compare moodle ids as text to allow numeric/string mix
          whereClauses.push(and(eq(userTable.dni, left), or(sql`${moodleUserTable.moodle_id}::text = ${right}`, sql`${userCourseTable.id_moodle_user}::text = ${right}`)));
        }
      } else {
        // if key doesn't contain dash, try to match by dni only
        whereClauses.push(eq(userTable.dni, k));
      }
    }

    const whereCondition = whereClauses.length ? or(...whereClauses) : undefined;
    // reuse the shared mapping/join logic and return all matching rows
    return this.fetchMappedRows(whereCondition);
  }

  async getReportRoles() {
    const q = this.query();
    const rows = await q
      .select({
        id_role: userRolesTable.id_role,
        role_shortname: userRolesTable.role_shortname,
      })
      .from(userRolesTable)
      .orderBy(userRolesTable.role_shortname);

    return rows;
  }
}
