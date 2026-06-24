import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { and, count, eq, sql } from "drizzle-orm";
import { UserCenterInsertModel, userCenterTable, UserCenterUpdateModel } from "src/database/schema/tables/user_center.table";
import { centerTable } from "src/database/schema/tables/center.table";
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

    /**
     * Conteo de usuarios por centro. La "baja" se deriva de end_date (Fecha de Baja del import):
     * activo = end_date IS NULL; baja = end_date IS NOT NULL (mismo criterio que user-merge).
     * - user_count: total de usuarios asociados.
     * - main_user_count: usuarios que lo tienen como centro principal.
     * - inactive_count: usuarios dados de baja.
     * - active_count: usuarios activos (asociados sin fecha de baja, aunque no sea su centro principal).
     */
    async countByCenter(options?: QueryOptions): Promise<Array<{ id_center: number; user_count: number; main_user_count: number; inactive_count: number; active_count: number }>> {
        const rows = await this.query(options)
            .select({
                id_center: userCenterTable.id_center,
                user_count: count(),
                main_user_count: sql<number>`count(*) filter (where ${userCenterTable.is_main_center})`,
                inactive_count: sql<number>`count(*) filter (where ${userCenterTable.end_date} is not null)`,
                active_count: sql<number>`count(*) filter (where ${userCenterTable.end_date} is null)`,
            })
            .from(userCenterTable)
            .groupBy(userCenterTable.id_center);
        return rows.map((r) => ({
            id_center: r.id_center,
            user_count: Number(r.user_count),
            main_user_count: Number(r.main_user_count),
            inactive_count: Number(r.inactive_count),
            active_count: Number(r.active_count),
        }));
    }

    /**
     * Conteo de usuarios por empresa (a través de sus centros). Mismos criterios que
     * countByCenter pero agregando por empresa y contando usuarios DISTINTOS, porque un
     * usuario puede pertenecer a varios centros de la misma empresa y no debe contarse dos veces.
     * - user_count: usuarios distintos asociados a algún centro de la empresa.
     * - main_user_count: usuarios cuyo centro principal pertenece a la empresa.
     * - inactive_count: usuarios con alguna baja (end_date IS NOT NULL) en la empresa.
     * - active_count: usuarios con alguna asociación activa (end_date IS NULL) en la empresa.
     */
    async countByCompany(options?: QueryOptions): Promise<Array<{ id_company: number; user_count: number; main_user_count: number; inactive_count: number; active_count: number }>> {
        const rows = await this.query(options)
            .select({
                id_company: centerTable.id_company,
                user_count: sql<number>`count(distinct ${userCenterTable.id_user})`,
                main_user_count: sql<number>`count(distinct ${userCenterTable.id_user}) filter (where ${userCenterTable.is_main_center})`,
                inactive_count: sql<number>`count(distinct ${userCenterTable.id_user}) filter (where ${userCenterTable.end_date} is not null)`,
                active_count: sql<number>`count(distinct ${userCenterTable.id_user}) filter (where ${userCenterTable.end_date} is null)`,
            })
            .from(userCenterTable)
            .innerJoin(centerTable, eq(userCenterTable.id_center, centerTable.id_center))
            .groupBy(centerTable.id_company);
        return rows.map((r) => ({
            id_company: r.id_company,
            user_count: Number(r.user_count),
            main_user_count: Number(r.main_user_count),
            inactive_count: Number(r.inactive_count),
            active_count: Number(r.active_count),
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