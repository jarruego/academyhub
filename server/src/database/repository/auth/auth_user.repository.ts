import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { authUserTable, AuthUserSelectModel, AuthUserInsertModel, AuthUserUpdateModel } from "src/database/schema/tables/auth_user.table";
import { eq, ilike, and } from "drizzle-orm";
import { DbCondition } from "src/database/types/db-expression";

@Injectable()
export class AuthUserRepository extends Repository {
    
    async findByUsername(username: string, options?: QueryOptions) {
        const rows = (await this.query(options).select().from(authUserTable).where(eq(authUserTable.username, username)));
        return rows?.[0];
    }

    async findById(id: number, options?: QueryOptions) {
        const rows = await this.query(options).select().from(authUserTable).where(eq(authUserTable.id, id));
        return rows?.[0];
    }

    async findAll(filter: Partial<AuthUserSelectModel> = {}, options?: QueryOptions) {
    const where: DbCondition[] = [];

        if (filter.name) where.push(ilike(authUserTable.name, `%${filter.name}%`));
        if (filter.lastName) where.push(ilike(authUserTable.lastName, `%${filter.lastName}%`));
        if (filter.email) where.push(ilike(authUserTable.email, `%${filter.email}%`));
        if (filter.username) where.push(eq(authUserTable.username, filter.username));
        if (filter.role) where.push(eq(authUserTable.role, filter.role));

        const q = this.query(options).select().from(authUserTable);

        if (where.length) {
            return await q.where(and(...where));
        }

        return await q;
    }

    async createUser(user: AuthUserInsertModel, options?: QueryOptions) {
        // Insert and return the created row to keep the API consistent and avoid a follow-up query
        const rows = await this.query(options).insert(authUserTable).values(user).returning();
        return rows?.[0];
    }

    async update(id: number, data: AuthUserUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(authUserTable)
            .set(data)
            .where(eq(authUserTable.id, id));
        return result;
    }

    async deleteById(id: number, options?: QueryOptions) {
        const result = await this.query(options)
            .delete(authUserTable)
            .where(eq(authUserTable.id, id));
        return result;
    }
}