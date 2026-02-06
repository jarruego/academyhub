import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import { and, eq, not, inArray } from "drizzle-orm";
import { UserGroupInsertModel, userGroupTable, UserGroupUpdateModel } from "src/database/schema/tables/user_group.table";
import { userRolesTable } from "src/database/schema/tables/user_roles.table";
import { userTable, UserSelectModel } from "src/database/schema/tables/user.table";
import { groupTable } from "src/database/schema/tables/group.table";
import { userCourseTable } from "src/database/schema/tables/user_course.table";
import { centers } from "src/database/schema";
import { InsertResult } from 'src/database/types/insert-result';
import { companyTable } from "src/database/schema/tables/company.table";

// Enriched user shape returned by findUsersInGroupByIds
export type UserWithEnrollmentInfo = UserSelectModel & {
    id_role?: number;
    role_shortname?: string | null;
    enrollment_center_id?: number | null;
    enrollment_company_cif?: string | null;
    // id_moodle_user associated to the user's enrollment in the course (nullable)
    id_moodle_user?: number | null;
    // Time spent in course (from user_course)
    time_spent?: number | null;
    // Fecha/hora local en la que este usuario fue añadido al grupo en Moodle (nullable)
    moodle_synced_at?: Date | null;
};

@Injectable()
export class UserGroupRepository extends Repository {
    async create(data: UserGroupInsertModel, options?: QueryOptions): Promise<InsertResult> {
        const q = this.query(options);

        // Si no viene indicado id_role, asignar el rol por defecto 'student'.
        // Si no existe en la BD, lo creamos on-demand para evitar fallos iniciales.
    let roleId = data.id_role as number | undefined;
        if (!roleId) {
            const existing = await q.select().from(userRolesTable).where(eq(userRolesTable.role_shortname, 'student'));
            if (existing && existing.length > 0) {
                roleId = existing[0].id_role;
            } else {
                const inserted = await q.insert(userRolesTable).values({ role_shortname: 'student', role_description: 'Estudiante' }).returning({ id_role: userRolesTable.id_role });
                roleId = inserted?.[0]?.id_role ?? undefined;
            }
        }

    const insertData: UserGroupInsertModel = { ...data, id_role: roleId };
    const result = await q.insert(userGroupTable).values(insertData).returning({ insertId: userGroupTable.id_user });
    return result?.[0] ?? {};
    }

    async updateById(userId: number, groupId: number, data: UserGroupUpdateModel, options?: QueryOptions) {
        return await this.query(options).update(userGroupTable).set(data).where(and(eq(userGroupTable.id_user, userId), eq(userGroupTable.id_group, groupId)));
    }

    async findByGroupAndUserId(groupId: number, userId: number, options?: QueryOptions) {
        return (await this.query(options).select().from(userGroupTable).where(and(eq(userGroupTable.id_group, groupId), eq(userGroupTable.id_user, userId))).limit(1))?.[0] ?? null;
    }

    async addUserToGroup(id_group: number, id_user: number, options?: QueryOptions) {
        // Delegar a create para aplicar la lógica de rol por defecto
        return await this.create({ id_user, id_group } as UserGroupInsertModel, options);
    }

    async findUsersInGroup(groupId: number, options?: QueryOptions): Promise<UserWithEnrollmentInfo[]> {
        // Seleccionamos explícitamente las tablas que necesitamos y hacemos leftJoin
        // con user_roles para devolver el role_shortname (si existe) junto al usuario.
        const rows = await this.query(options)
            .select({ users: userTable, user_course: userCourseTable, user_group: userGroupTable, role: userRolesTable, center: centers, company: companyTable })
            .from(userGroupTable)
            .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
            .innerJoin(groupTable, eq(userGroupTable.id_group, groupTable.id_group))
            .innerJoin(userCourseTable, and(
                eq(userCourseTable.id_user, userGroupTable.id_user),
                eq(userCourseTable.id_course, groupTable.id_course)
            ))
            .leftJoin(userRolesTable, eq(userGroupTable.id_role, userRolesTable.id_role))
            .leftJoin(centers, eq(userGroupTable.id_center, centers.id_center))
            .leftJoin(companyTable, eq(centers.id_company, companyTable.id_company))
            .where(eq(userGroupTable.id_group, groupId));

        // Mezclar los datos del usuario, completion_percentage y rol (si lo hay)
        return rows.map((r) => ({
            ...r.users,
            completion_percentage: r.user_course.completion_percentage,
            time_spent: r.user_course.time_spent ?? null,
            id_role: r.user_group?.id_role,
            role_shortname: r.role?.role_shortname,
            enrollment_center_id: r.user_group?.id_center,
            enrollment_company_cif: r.company?.cif,
            id_moodle_user: r.user_course?.id_moodle_user ?? null,
            moodle_synced_at: r.user_group?.moodle_synced_at ?? null,
        }));
    }

    async findUsersInGroupByIds(groupId: number, userIds: number[], options?: QueryOptions): Promise<UserWithEnrollmentInfo[]> {
        const rows = await this.query(options)
            .select({ users: userTable, user_group: userGroupTable, role: userRolesTable, center: centers, company: companyTable })
            .from(userGroupTable)
            .innerJoin(userTable, eq(userGroupTable.id_user, userTable.id_user))
            .innerJoin(centers, eq(userGroupTable.id_center, centers.id_center))
            .innerJoin(companyTable, eq(centers.id_company, companyTable.id_company))
            .leftJoin(userRolesTable, eq(userGroupTable.id_role, userRolesTable.id_role))
            .where(and(eq(userGroupTable.id_group, groupId), inArray(userGroupTable.id_user, userIds)));
        return rows.map((r) => ({
            ...r.users,
            id_role: r.user_group?.id_role,
            role_shortname: r.role?.role_shortname,
            // include the center at enrollment and the company's CIF so callers can group by the enrollment company
            enrollment_center_id: r.user_group?.id_center,
            enrollment_company_cif: r.company?.cif,
            // for this variant we don't have user_course joined; id_moodle_user will be null
            id_moodle_user: null,
            time_spent: null,
            moodle_synced_at: r.user_group?.moodle_synced_at ?? null,
        }));
    }

    async updateUserInGroup(id_group: number, id_user: number, data: UserGroupUpdateModel, options?: QueryOptions) {
        const result = await this.query(options)
            .update(userGroupTable)
            .set(data)
            .where(and(eq(userGroupTable.id_group, id_group), eq(userGroupTable.id_user, id_user)));
        return result;
    }

    async clearMoodleSyncedAtByUserId(id_user: number, options?: QueryOptions) {
        return await this.query(options)
            .update(userGroupTable)
            .set({ moodle_synced_at: null })
            .where(eq(userGroupTable.id_user, id_user));
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

    /**
     * Busca un role por su shortname en la tabla user_roles. Si no existe, lo crea.
     * Devuelve el id_role o undefined si no se pudo obtenerlo.
     */
    async findOrCreateRoleByShortname(roleShortname: string, options?: QueryOptions) {
        const q = this.query(options);
        const existing = await q.select().from(userRolesTable).where(eq(userRolesTable.role_shortname, roleShortname));
        if (existing && existing.length > 0) return existing[0].id_role;

        const inserted = await q.insert(userRolesTable).values({ role_shortname: roleShortname, role_description: roleShortname }).returning({ id_role: userRolesTable.id_role });
        return inserted?.[0]?.id_role ?? undefined;
    }
}