import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserInsertModel, UserSelectModel, userTable, UserUpdateModel } from "src/database/schema/tables/user.table";
import { eq, ilike, and, sql, or, count, inArray } from "drizzle-orm";
import { users } from "src/database/schema";
import { FilterUserDTO } from "src/dto/user/filter-user.dto";
import type { UsersColumns } from "src/database/schema";
import { DbCondition } from "src/database/types/db-expression";
import { userCenterTable } from "src/database/schema/tables/user_center.table";
import { centers } from "src/database/schema";

@Injectable()
export class UserRepository extends Repository {
  /**
   * Buscar usuario por DNI
   */
  async findByDni(dni: string, options?: QueryOptions) {
    const rows = await this.query(options).select().from(userTable).where(eq(userTable.dni, dni));
    return rows?.[0] || null;
  }

  async findById(id: number, options?: QueryOptions) {
    const rows = await this.query(options).select().from(userTable).where(eq(userTable.id_user, id));
    return rows?.[0];
  }

  async create(data: UserInsertModel, options?: QueryOptions): Promise<{ insertId: number }> {
    const result = await this.query(options)
      .insert(userTable)
      .values(data)
      .returning({ insertId: userTable.id_user });
    return result[0];
  }

  async update(id: number, data: UserUpdateModel, options?: QueryOptions) {
      const result = await this.query(options)
        .update(userTable)
        .set(data)
        .where(eq(userTable.id_user, id));
      return result;
  }

  async delete(id: number, options?: QueryOptions) {
    const result = await this.query(options)
      .delete(userTable)
      .where(eq(userTable.id_user, id));
    return result;
  }

  async findAll(filter: Partial<UserSelectModel>, options?: QueryOptions) {
        const where = [];

        if (filter.name) where.push(ilike(userTable.name, `%{filter.name}%`));
        if (filter.first_surname) where.push(ilike(userTable.first_surname, `%{filter.first_surname}%`));
        if (filter.second_surname) where.push(ilike(userTable.second_surname, `%{filter.second_surname}%`));
        if (filter.email) where.push(ilike(userTable.email, `%{filter.email}%`));
        if (filter.dni) where.push(ilike(userTable.dni, `%{filter.dni}%`));
        if (filter.phone) where.push(ilike(userTable.phone, `%{filter.phone}%`));
        if (filter.nss) where.push(ilike(userTable.nss, `%{filter.nss}%`));
        // if (filter.document_type) where.push(ilike(userTable.document_type, `%{filter.document_type}%`));
        if (filter.birth_date) where.push(eq(userTable.birth_date, filter.birth_date));
        if (filter.professional_category) where.push(ilike(userTable.professional_category, `%{filter.professional_category}%`));
        if (filter.salary_group) where.push(eq(userTable.salary_group, filter.salary_group));
        if (filter.education_level) where.push(ilike(userTable.education_level, `%{filter.education_level}%`));
        if (filter.postal_code) where.push(ilike(userTable.postal_code, `%{filter.postal_code}%`));
        if (filter.city) where.push(ilike(userTable.city, `%{filter.city}%`));
        if (filter.province) where.push(ilike(userTable.province, `%{filter.province}%`));
        if (filter.country) where.push(ilike(userTable.country, `%{filter.country}%`));
        if (filter.observations) where.push(ilike(userTable.observations, `%{filter.observations}%`));
        
        return await this.query(options).select().from(userTable).where(and(...where));
  }

  // Paginated search with filters: search, page, limit, id_center, id_company
  async findAllPaginated(filter: Partial<FilterUserDTO> = {}, options?: QueryOptions) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 100;
    const offset = (page - 1) * limit;

  const conditions: DbCondition[] = [];

    if (filter.search) {
      const normalizedSearch = String(filter.search).trim().replace(/\s+/g, ' ');
      const searchTerm = `%${normalizedSearch}%`;
  type TableColumn = UsersColumns[keyof UsersColumns];
  const unaccentLike = (col: TableColumn, term: string) => sql`unaccent(lower(${col})) LIKE unaccent(lower(${term}))`;

      const searchWords = normalizedSearch.split(' ').filter((w: string) => w.length > 0);
      if (searchWords.length === 1) {
        conditions.push(
          or(
            unaccentLike(users.name, searchTerm),
            unaccentLike(users.first_surname, searchTerm),
            unaccentLike(users.second_surname, searchTerm),
            unaccentLike(users.email, searchTerm),
            unaccentLike(users.dni, searchTerm),
            unaccentLike(users.nss, searchTerm)
          )
        );
      } else {
  const multiWordConditions: DbCondition[] = [];
        searchWords.forEach((word: string) => {
          const term = `%${word}%`;
          multiWordConditions.push(
            or(
              unaccentLike(users.name, term),
              unaccentLike(users.first_surname, term),
              unaccentLike(users.second_surname, term),
              unaccentLike(users.email, term),
              unaccentLike(users.dni, term),
              unaccentLike(users.nss, term)
            )
          );
        });
        conditions.push(and(...multiWordConditions));
      }
    }

    if (filter.dni) conditions.push(sql`unaccent(lower(${users.dni})) LIKE unaccent(lower(${`%${filter.dni}%`}))`);
    if (filter.name) conditions.push(sql`unaccent(lower(${users.name})) LIKE unaccent(lower(${`%${filter.name}%`}))`);
    if (filter.first_surname) conditions.push(sql`unaccent(lower(${users.first_surname})) LIKE unaccent(lower(${`%${filter.first_surname}%`}))`);
    if (filter.email) conditions.push(sql`unaccent(lower(${users.email})) LIKE unaccent(lower(${`%${filter.email}%`}))`);

    if (filter.id_center) {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${userCenterTable} uc WHERE uc.id_user = ${users.id_user} AND uc.id_center = ${filter.id_center})`);
    }

    if (filter.id_company) {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${userCenterTable} uc JOIN ${centers} c ON uc.id_center = c.id_center WHERE uc.id_user = ${users.id_user} AND c.id_company = ${filter.id_company})`);
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.query(options)
      .select({ count: count() })
      .from(users)
      .where(whereCondition);

    const total = totalResult?.[0]?.count || 0;

    const usersList = await this.query(options)
      .select()
      .from(users)
      .where(whereCondition)
      .orderBy(users.id_user)
      .limit(limit)
      .offset(offset);

    return {
      data: usersList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

}