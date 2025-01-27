import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { authUserTable } from "src/database/schema/tables/auth_user.table";
import { eq } from "drizzle-orm";

@Injectable()
export class AuthUserRepository extends Repository {
    
    async findByUsername(username: string, options?: QueryOptions) {
        const rows = (await this.query(options).select().from(authUserTable).where(eq(authUserTable.username, username)));

        /**
         * Es lo mismo que
         * if (rows.length === 0) return null;
         * else return[0];
         */

        return rows?.[0];
    }

    async createUser(user: { username: string; password: string; email: string; name: string; lastName?: string }) {
        const [newUser] = await this.query().insert(authUserTable).values(user).returning({
            id: authUserTable.id,
            username: authUserTable.username,
            email: authUserTable.email,
            name: authUserTable.name,
            lastName: authUserTable.lastName,
            createdAt: authUserTable.createdAt,
            updatedAt: authUserTable.updatedAt
        });
        return newUser;
    }
}