import { Injectable } from "@nestjs/common";
import { desc, eq, or, sql } from "drizzle-orm";
import { users, courses, catalog_courses, companies, centers } from "src/database/schema";
import { QueryOptions, Repository } from "../repository";

/**
 * Consultas de búsqueda global (dashboard Home): deliberadamente separadas de
 * los repositorios de cada entidad — son SELECT mínimos con LIMIT pensados
 * para un buscador en vivo (mientras se escribe), no listados completos como
 * `CourseRepository.findAll`/`CompanyRepository.findAll` (sin límite, pensados
 * para cargar todo el listado en el cliente).
 */
@Injectable()
export class SearchRepository extends Repository {
  async searchUsers(term: string, limit: number, options?: QueryOptions) {
    const like = `%${term}%`;
    return this.query(options)
      .select({
        id_user: users.id_user,
        name: users.name,
        first_surname: users.first_surname,
        second_surname: users.second_surname,
        dni: users.dni,
      })
      .from(users)
      .where(
        or(
          sql`unaccent(lower(${users.name})) LIKE unaccent(lower(${like}))`,
          sql`unaccent(lower(${users.first_surname})) LIKE unaccent(lower(${like}))`,
          sql`unaccent(lower(${users.second_surname})) LIKE unaccent(lower(${like}))`,
          sql`unaccent(lower(${users.dni})) LIKE unaccent(lower(${like}))`,
        ),
      )
      .orderBy(users.name)
      .limit(limit);
  }

  async searchCourses(term: string, limit: number, options?: QueryOptions) {
    const like = `%${term}%`;
    return this.query(options)
      .select({
        id_course: courses.id_course,
        catalog_course_name: catalog_courses.name,
        catalog_course_short_name: catalog_courses.short_name,
        file_number: courses.file_number,
      })
      .from(courses)
      .innerJoin(catalog_courses, eq(courses.id_catalog_course, catalog_courses.id_catalog_course))
      .where(
        or(
          sql`unaccent(lower(${catalog_courses.name})) LIKE unaccent(lower(${like}))`,
          sql`unaccent(lower(${catalog_courses.short_name})) LIKE unaccent(lower(${like}))`,
          sql`unaccent(lower(${courses.course_name})) LIKE unaccent(lower(${like}))`,
          sql`${courses.file_number} ILIKE ${like}`,
        ),
      )
      .orderBy(desc(courses.id_course))
      .limit(limit);
  }

  async searchCompanies(term: string, limit: number, options?: QueryOptions) {
    const like = `%${term}%`;
    return this.query(options)
      .select({ id_company: companies.id_company, company_name: companies.company_name, cif: companies.cif })
      .from(companies)
      .where(
        or(
          sql`unaccent(lower(${companies.company_name})) LIKE unaccent(lower(${like}))`,
          sql`unaccent(lower(${companies.corporate_name})) LIKE unaccent(lower(${like}))`,
          sql`${companies.cif} ILIKE ${like}`,
        ),
      )
      .orderBy(companies.company_name)
      .limit(limit);
  }

  async searchCenters(term: string, limit: number, options?: QueryOptions) {
    const like = `%${term}%`;
    return this.query(options)
      .select({ id_center: centers.id_center, center_name: centers.center_name })
      .from(centers)
      .where(sql`unaccent(lower(${centers.center_name})) LIKE unaccent(lower(${like}))`)
      .orderBy(centers.center_name)
      .limit(limit);
  }
}
