import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { userTable } from "src/database/schema/tables/user.table";
import { eq } from "drizzle-orm";
import { hashWithSalt } from "src/utils/crypto/password-hashing.util";

@Injectable()
export class UserRepository extends Repository {
    
    async findByUsername(username: string, options?: QueryOptions) {
        const rows = (await this.query(options).select().from(userTable).where(eq(userTable.username, username)));

        /**
         * Es lo mismo que
         * if (rows.length === 0) return null;
         * else return[0];
         */

        return rows?.[0];
    }
}