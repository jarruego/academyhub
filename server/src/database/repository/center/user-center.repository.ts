import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { and, eq } from "drizzle-orm";
import { UserCenterInsertModel, userCenterTable, UserCenterUpdateModel } from "src/database/schema/tables/user_center.table";

@Injectable()
export class UserCenterRepository extends Repository {
    async create(data: UserCenterInsertModel, options?: QueryOptions) {
        return await this.query(options).insert(userCenterTable).values(data);
    }

    async updateById(userId: number, centerId: number, data: UserCenterUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userCenterTable).set(data).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId)));
    }

    async updateByUserId(userId: number, data: UserCenterUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userCenterTable).set(data).where(eq(userCenterTable.id_user, userId));
    }
}