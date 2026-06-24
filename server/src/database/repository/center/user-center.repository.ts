import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { and, count, eq, sql } from "drizzle-orm";
import { UserCenterInsertModel, userCenterTable, UserCenterUpdateModel } from "src/database/schema/tables/user_center.table";
import { InsertResult } from 'src/database/types/insert-result';

@Injectable()
export class UserCenterRepository extends Repository {
    async create(data: UserCenterInsertModel, options?: QueryOptions): Promise<InsertResult> {
        const result = await this.query(options).insert(userCenterTable).values(data).returning({ insertId: userCenterTable.id_user });
        return result?.[0] ?? {};
    }

    async updateById(userId: number, centerId: number, data: UserCenterUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userCenterTable).set(data).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId)));
    }

    async updateByUserId(userId: number, data: UserCenterUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userCenterTable).set(data).where(eq(userCenterTable.id_user, userId));
    }

    /** Conteo de usuarios por centro: total asociados y total que lo tienen como centro principal. */
    async countByCenter(options?: QueryOptions): Promise<Array<{ id_center: number; user_count: number; main_user_count: number }>> {
        const rows = await this.query(options)
            .select({
                id_center: userCenterTable.id_center,
                user_count: count(),
                main_user_count: sql<number>`count(*) filter (where ${userCenterTable.is_main_center})`,
            })
            .from(userCenterTable)
            .groupBy(userCenterTable.id_center);
        return rows.map((r) => ({
            id_center: r.id_center,
            user_count: Number(r.user_count),
            main_user_count: Number(r.main_user_count),
        }));
    }

    async findUsersInCenter(centerId: number, options?: QueryOptions) {
        const rows = await this.query(options)
            .select()
            .from(userCenterTable)
            .where(eq(userCenterTable.id_center, centerId));
        return rows;
    }

    async updateUserInCenter(id_center: number, id_user: number, data: UserCenterUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(userCenterTable)
            .set(data)
            .where(and(eq(userCenterTable.id_center, id_center), eq(userCenterTable.id_user, id_user)));
        return result;
    }

    async deleteUserFromCenter(id_center: number, id_user: number, options?: QueryOptions) {
        const result = await this.query(options)
            .delete(userCenterTable)
            .where(and(eq(userCenterTable.id_center, id_center), eq(userCenterTable.id_user, id_user)));
        return result;
    }
}