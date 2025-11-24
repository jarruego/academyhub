import { Injectable } from "@nestjs/common";
import { Repository, QueryOptions } from "../repository";
import { and, eq, sql, or, count, desc } from "drizzle-orm";
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

@Injectable()
export class ReportsRepository extends Repository {
  /**
   * Devuelve un listado plano con información cruzada por usuario/inscripción
   */
  async getReportRows(filter?: ReportFilterDTO, options?: QueryOptions) {
    const q = this.query(options);

    const page = Number(filter?.page) || 1;
    const limit = Number(filter?.limit) || 100;
    const offset = (page - 1) * limit;

    const where: any[] = [];

    // support arrays for company/center filters (multiple selection)
    if (filter?.id_company) {
      if (Array.isArray(filter.id_company) && filter.id_company.length) {
        where.push(or(...filter.id_company.map((id) => eq(companyTable.id_company, Number(id)))));
      } else if (!Array.isArray(filter.id_company)) {
        where.push(eq(companyTable.id_company, filter.id_company));
      }
    }
    if (filter?.id_center) {
      if (Array.isArray(filter.id_center) && filter.id_center.length) {
        where.push(or(...filter.id_center.map((id) => eq(centers.id_center, Number(id)))));
      } else if (!Array.isArray(filter.id_center)) {
        where.push(eq(centers.id_center, filter.id_center));
      }
    }
    if (filter?.id_course) where.push(eq(courseTable.id_course, filter.id_course));
    if (filter?.id_role) where.push(eq(userGroupTable.id_role, filter.id_role));

    if (filter?.start_date) where.push(sql`${groupTable.start_date} >= ${filter.start_date}`);
    if (filter?.end_date) where.push(sql`${groupTable.end_date} <= ${filter.end_date}`);

    if (filter?.search) {
      const term = `%${String(filter.search).trim().toLowerCase()}%`;
      where.push(or(
        sql`lower(${userTable.name}) LIKE ${term}`,
        sql`lower(${userTable.dni}) LIKE ${term}`,
        sql`lower(${userTable.email}) LIKE ${term}`,
      ));
    }

    const whereCondition = where.length > 0 ? and(...where) : undefined;

    // total count
    const totalResult = await q
      .select({ total: count() })
      .from(userGroupTable)
      .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
      .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
      .innerJoin(courseTable, eq(groupTable.id_course, courseTable.id_course))
      .leftJoin(userCenterTable, and(eq(userCenterTable.id_user, userTable.id_user), eq(userCenterTable.is_main_center, true)))
      .leftJoin(centers, eq(userCenterTable.id_center, centers.id_center))
      .leftJoin(companyTable, eq(centers.id_company, companyTable.id_company))
      .where(whereCondition);

    const total = Number(totalResult?.[0]?.total ?? 0);

    // Build order clause from requested sort field/order, but only allow known columns
    const sortableMap: Record<string, any> = {
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
      course_name: courseTable.course_name,
      moodle_id: moodleUserTable.moodle_id,
      moodle_username: moodleUserTable.moodle_username,
    };

    let orderClause: any = userTable.id_user;
    if (filter?.sort_field) {
      const col = sortableMap[String(filter.sort_field)];
      if (col) {
        orderClause = filter.sort_order === 'desc' ? desc(col) : col;
      }
    }

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
      .leftJoin(moodleUserTable, eq(moodleUserTable.id_user, userTable.id_user))
      .leftJoin(userCenterTable, and(eq(userCenterTable.id_user, userTable.id_user), eq(userCenterTable.is_main_center, true)))
      .leftJoin(centers, eq(userCenterTable.id_center, centers.id_center))
      .leftJoin(companyTable, eq(centers.id_company, companyTable.id_company))
  .where(whereCondition)
  .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    const mapped = rows.map((r) => ({
      id_user: r.user?.id_user,
      id_group: r.user_group?.id_group,
      name: r.user?.name,
      first_surname: r.user?.first_surname,
      second_surname: r.user?.second_surname,
      dni: r.user?.dni,
      email: r.user?.email,
      phone: r.user?.phone,
      center_name: r.center?.center_name ?? null,
      employer_number: r.center?.employer_number ?? null,
      company_name: r.company?.company_name ?? null,
      company_cif: r.company?.cif ?? null,
      group_name: r.group?.group_name ?? null,
      group_start_date: r.group?.start_date ?? null,
      group_end_date: r.group?.end_date ?? null,
      role_shortname: r.role?.role_shortname ?? null,
      completion_percentage: r.user_group?.completion_percentage ?? r.user_course?.completion_percentage ?? null,
      course_name: r.course?.course_name ?? null,
      moodle_id: r.moodle_user?.moodle_id ?? r.user_course?.id_moodle_user ?? null,
      moodle_username: r.moodle_user?.moodle_username ?? null,
      moodle_password: r.moodle_user?.moodle_password ?? null,
    }));

    // Deduplicate rows that may repeat due to LEFT JOINs (user_course, moodle_user, etc.).
    // Use the primary composite key id_user-id_group when available; fall back to dni-moodle_id.
    const uniqueMap = new Map<string, (typeof mapped)[number]>();
    for (const r of mapped) {
      const key = (r.id_user != null && r.id_group != null)
        ? `${r.id_user}-${r.id_group}`
        : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, r);
    }
    const uniqueArr = Array.from(uniqueMap.values());

    return {
      data: uniqueArr,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
