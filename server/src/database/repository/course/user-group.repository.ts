import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { UserCourseInsertModel, userCourseTable, UserCourseUpdateModel } from "src/database/schema/tables/user_course.table";
import { and, eq } from "drizzle-orm";
import { UserGroupInsertModel, userGroupTable, UserGroupUpdateModel } from "src/database/schema/tables/user_group.table";

@Injectable()
export class UserGroupRepository extends Repository {
    async create(data: UserGroupInsertModel, options?: QueryOptions) {
        return await this.query(options).insert(userGroupTable).values(data);
    }

    async updateById(userId: number, groupId: number, data: UserGroupUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userGroupTable).set(data).where(and(eq(userGroupTable.id_user, userId), eq(userGroupTable.id_group, groupId)));
    }

    async findByGroupAndUserId(groupId: number, userId: number, options?: QueryOptions) {
        return (await this.query(options).select().from(userGroupTable).where(and(eq(userGroupTable.id_group, groupId), eq(userGroupTable.id_user, userId))).limit(1))?.[0] ?? null;
    }
}