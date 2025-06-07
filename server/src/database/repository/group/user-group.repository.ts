import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { and, eq, not, inArray } from "drizzle-orm";
import { UserGroupInsertModel, userGroupTable, UserGroupUpdateModel } from "src/database/schema/tables/user_group.table";
import { userTable } from "src/database/schema/tables/user.table";
import { groupTable } from "src/database/schema/tables/group.table";

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

    // --- FUNCIONES MOVIDAS DESDE GROUP REPOSITORY ---

    async addUserToGroup(id_group: number, id_user: number, options?: QueryOptions) {
        return await this.query(options)
            .insert(userGroupTable)
            .values({ id_user, id_group });
    }

    async findUsersInGroup(groupId: number, options?: QueryOptions) {
        const rows = await this.query(options)
            .select()
            .from(userGroupTable)
            .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
            .where(eq(userGroupTable.id_group, groupId));
        return rows.map((r) => r.users);
    }

    async findUsersInGroupByIds(groupId: number, userIds: number[], options?: QueryOptions) {
        const rows = await this.query(options)
            .select()
            .from(userGroupTable)
            .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
            .where(and(eq(userGroupTable.id_group, groupId), inArray(userGroupTable.id_user, userIds)));
        return rows.map((r) => r.users);
    }

    async updateUserInGroup(id_group: number, id_user: number, data: UserGroupUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(userGroupTable)
            .set(data)
            .where(and(eq(userGroupTable.id_group, id_group), eq(userGroupTable.id_user, id_user)));
        return result;
    }

    async deleteUserFromGroup(id_group: number, id_user: number, options?: QueryOptions) {
        const result = await this.query(options)
            .delete(userGroupTable)
            .where(and(eq(userGroupTable.id_group, id_group), eq(userGroupTable.id_user, id_user)));
        return result;
    }

    async isUserEnrolledInOtherGroups(id_group: number, id_user: number, options?: QueryOptions) {
        // Necesitamos obtener el id_course del grupo
        const group = await this.query(options).select().from(groupTable).where(eq(groupTable.id_group, id_group));
        if (!group[0]) return false;
        const query = this.query(options)
            .select()
            .from(userGroupTable)
            .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
            .where(and(
                eq(userGroupTable.id_user, id_user),
                eq(groupTable.id_course, group[0].id_course),
                not(eq(userGroupTable.id_group, id_group))
            ));
        const otherGroups = await query;
        return otherGroups.length > 0;
    }

    async findUserInGroup(id_user: number, id_group: number, options?: QueryOptions) {
        const rows = await this.query(options)
            .select()
            .from(userGroupTable)
            .where(and(eq(userGroupTable.id_user, id_user), eq(userGroupTable.id_group, id_group)));
        return rows;
    }
}