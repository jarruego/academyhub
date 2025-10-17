import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserInsertModel, UserSelectModel, userTable, UserUpdateModel } from "src/database/schema/tables/user.table";
import { eq, ilike, and } from "drizzle-orm";


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

}