import { Injectable, HttpException, HttpStatus, InternalServerErrorException, Logger, Inject } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { decryptSecret, tryEncryptSecret } from '../../utils/crypto/secrets.util';
import { MoodleCourse } from 'src/types/moodle/course';
import { MoodleGroup, CreatedGroupResponseItem } from 'src/types/moodle/group';
import { MoodleUser, ExtendedMoodleUser } from 'src/types/moodle/user';
import { MoodleCourseWithImportStatus, MoodleGroupWithImportStatus, ImportResult } from 'src/dto/moodle/import.dto';
import { DatabaseService } from 'src/database/database.service';
import { organizationSettingsTable } from 'src/database/schema/tables/organization_settings.table';
import { eq } from 'drizzle-orm';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { QueryOptions, Transaction } from 'src/database/repository/repository';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { MoodleUserService } from '../moodle-user/moodle-user.service';
import { GroupService } from '../group/group.service';
import { CourseModality } from 'src/types/course/course-modality.enum';
import { UserCourseInsertModel } from 'src/database/schema/tables/user_course.table';
import { UserInsertModel, UserUpdateModel } from 'src/database/schema/tables/user.table';
import { UserGroupSelectModel } from 'src/database/schema/tables/user_group.table';

type RequestOptions<D extends MoodleParams = MoodleParams> = {
    params?: D;
    method?: 'get' | 'post';
}

// Typing for Moodle webservice request params. Moodle expects form-encoded
// values where values can be strings, numbers, booleans, objects or arrays
// of the same. This narrows `any` while remaining flexible for Moodle payloads.
type MoodleParamsValue = string | number | boolean | object | Array<string | number | boolean | object> | null | undefined;
type MoodleParams = Record<string, MoodleParamsValue>;

@Injectable()
export class MoodleService {
    private readonly MOODLE_URL = process.env.MOODLE_URL;
    // Keep env var as fallback; DB-configured token will take precedence when present
    private readonly MOODLE_TOKEN = process.env.MOODLE_TOKEN;

    constructor(
        @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
        private readonly courseRepository: CourseRepository,
        private readonly groupRepository: GroupRepository,
        private readonly organizationRepository: OrganizationRepository,
        private readonly userCourseRepository: UserCourseRepository,
        private readonly userRepository: UserRepository,
        private readonly userGroupRepository: UserGroupRepository,
        private readonly moodleUserService: MoodleUserService,
        private readonly groupService: GroupService,
    ) { }

    /**
     * Makes an HTTP request to the Moodle API with the specified function name and request options.
     * 
     * @template R - The expected response type.
     * @template D - The type of the request data.
     * @param {string} fn - The name of the Moodle web service function to call.
     * @param {RequestOptions<D>} [options] - The request options including parameters and HTTP method.
     * @param {D} [options.params] - The parameters to include in the request.
     * @param {string} [options.method='get'] - The HTTP method to use for the request.
     * @returns {Promise<R>} - A promise that resolves to the response data of type R.
     * @throws {InternalServerErrorException} - Throws an internal server error exception if the request fails or Moodle returns an error.
     */
    private async request<R = unknown, D extends MoodleParams = MoodleParams>(fn: string, { params: paramsData, method = 'get' }: RequestOptions<D> = {}): Promise<R> {
        // Resolve token and URL with DB (priority) -> env fallback
        const resolvedToken = await this.resolveMoodleToken();
        const resolvedUrl = await this.resolveMoodleUrl();
        if (!resolvedUrl) throw new InternalServerErrorException('Moodle URL not configured');
        const params: MoodleParams = {
            ...(paramsData ?? {}),
            wstoken: resolvedToken,
            wsfunction: fn,
            moodlewsrestformat: 'json',
        };

        const isMoodleError = (d: unknown): d is { exception: unknown } => typeof d === 'object' && d !== null && 'exception' in (d as Record<string, unknown>);

        try {
            // If method is POST, send params in the request body as form-encoded to avoid URL length limits (414)
            if (method === 'post') {
                const body = new URLSearchParams();
                for (const [k, v] of Object.entries(params) as [string, MoodleParamsValue][]) {
                    if (Array.isArray(v)) {
                        for (const item of v) {
                            if (item && typeof item === 'object') {
                                body.append(`${k}[]`, JSON.stringify(item));
                            } else {
                                body.append(`${k}[]`, String(item));
                            }
                        }
                    } else if (v && typeof v === 'object') {
                        body.append(k, JSON.stringify(v));
                    } else if (v !== undefined && v !== null) {
                        body.append(k, String(v));
                    }
                }

                const response = await axios.request<R, AxiosResponse<R>>({
                    url: resolvedUrl,
                    method,
                    data: body.toString(),
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });

                if (isMoodleError(response.data)) {
                    const moodleErr = response.data as { exception: unknown };
                    Logger.error({ moodleError: moodleErr, params, url: resolvedUrl }, 'MoodleService:request - moodle error (post)');
                    const exMsg = typeof moodleErr.exception === 'string' ? moodleErr.exception : JSON.stringify(moodleErr.exception);
                    throw new InternalServerErrorException(exMsg || 'Moodle returned an error');
                }
                return response.data as R;
            }

            const response = await axios.request<R, AxiosResponse<R>>({ url: resolvedUrl, params, method });

            if (isMoodleError(response.data)) {
                const moodleErr = response.data as { exception: unknown };
                Logger.error({ moodleError: moodleErr, params, url: resolvedUrl }, 'MoodleService:request - moodle error (get)');
                const exMsg = typeof moodleErr.exception === 'string' ? moodleErr.exception : JSON.stringify(moodleErr.exception);
                throw new InternalServerErrorException(exMsg || 'Moodle returned an error');
            }

            return response.data as R;
        } catch (err: unknown) {
            // Better error typing / handling using axios helper
            if (axios.isAxiosError(err)) {
                Logger.error({
                    message: err.message,
                    status: err.response?.status,
                    responseData: err.response?.data,
                    params,
                    url: resolvedUrl,
                }, "MoodleService:request");

                const message = err.message || (err.response && JSON.stringify(err.response)) || 'Error calling Moodle API';
                throw new InternalServerErrorException(message);
            }

            // Non-axios error
            Logger.error({ message: String(err), params, url: resolvedUrl }, 'MoodleService:request');
            throw new InternalServerErrorException(String(err) || 'Error calling Moodle API');
        }
    }

    /**
     * Resolve the Moodle token. Priority: DB (organization_settings.encrypted_secrets.moodle_token) -> process.env.MOODLE_TOKEN
     * For single-center deployments we pick the first organization_settings row if no centerId is provided.
     */
    private async resolveMoodleToken(centerId?: number): Promise<string | undefined> {
        try {
            // Try to find a token configured in the DB
            let rows: any[] = [];
            if (typeof centerId === 'number') {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).where(eq(organizationSettingsTable.center_id, centerId)).limit(1);
            } else {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).limit(1);
            }
            if (rows && rows.length > 0) {
                const row = rows[0] as any;
                const secrets = row.encrypted_secrets ?? {};
                // Support multiple keys historically used for storing the token.
                const candidates = ['moodle_token', 'moodle_token_plain', 'moodleToken', 'moodle_token_encrypted', 'token'];
                for (const key of candidates) {
                    const enc = secrets[key];
                    if (enc) {
                        // If value is a string, assume plaintext (legacy/dev).
                        if (typeof enc === 'string') {
                            // Try to encrypt and persist the plaintext token so future reads use the secure form.
                            try {
                                const encrypted = tryEncryptSecret(enc);
                                if (encrypted) {
                                    const newSecrets = { ...secrets } as Record<string, unknown>;
                                    newSecrets[key] = encrypted;
                                    try {
                                        await this.databaseService.db.update(organizationSettingsTable).set({ encrypted_secrets: newSecrets }).where(eq(organizationSettingsTable.id, row.id));
                                        Logger.log({ key }, 'MoodleService:resolveMoodleToken - encrypted plaintext token in DB');
                                    } catch (updErr) {
                                        Logger.warn({ updErr }, 'MoodleService:resolveMoodleToken - failed to persist encrypted token');
                                    }
                                    // Return decrypted value from the encrypted object to ensure consistent behavior
                                    return decryptSecret(encrypted);
                                }
                            } catch (e) {
                                Logger.warn({ e }, 'MoodleService:resolveMoodleToken - encryption attempt failed; falling back to plaintext');
                                return enc;
                            }
                            return enc;
                        }
                        try {
                            return decryptSecret(enc);
                        } catch (e) {
                            Logger.warn({ err: e, key }, `MoodleService:resolveMoodleToken - failed to decrypt token for key=${key}; trying next`);
                        }
                    }
                }
                // Also support nested shape like { moodle: { token: '...' } }
                if (secrets.moodle && typeof secrets.moodle === 'object') {
                    const nested = (secrets.moodle as Record<string, unknown>).token;
                    if (nested) {
                        if (typeof nested === 'string') return nested;
                        try { return decryptSecret(nested); } catch (e) { Logger.warn({ e }, 'MoodleService:resolveMoodleToken - failed to decrypt nested token'); }
                    }
                }
            }
        } catch (e) {
            Logger.warn({ e }, 'MoodleService:resolveMoodleToken - DB lookup failed, falling back to env');
        }

        return this.MOODLE_TOKEN;
    }

    /**
     * Resolve the Moodle URL. Priority: DB encrypted_secrets.moodle_url -> settings.moodle.url -> process.env.MOODLE_URL
     * Accepts encrypted URL objects (same shape as for tokens) and will attempt to decrypt them.
     */
    private async resolveMoodleUrl(centerId?: number): Promise<string | undefined> {
        try {
            let rows: any[] = [];
            if (typeof centerId === 'number') {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).where(eq(organizationSettingsTable.center_id, centerId)).limit(1);
            } else {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).limit(1);
            }

            if (rows && rows.length > 0) {
                const row = rows[0] as any;
                const enc = row.encrypted_secrets?.moodle_url;
                if (enc) {
                    if (typeof enc === 'string') return enc;
                    try {
                        return decryptSecret(enc);
                    } catch (e) {
                        Logger.warn({ err: e }, 'MoodleService:resolveMoodleUrl - failed to decrypt url; falling back to settings/env');
                    }
                }

                // Try settings.moodle.url or a couple of common alternatives
                const s = row.settings ?? {};
                if (s.moodle?.url) return s.moodle.url;
                if (s.moodle_url) return s.moodle_url;
                if (s.moodleUrl) return s.moodleUrl;
            }
        } catch (e) {
            Logger.warn({ e }, 'MoodleService:resolveMoodleUrl - DB lookup failed, falling back to env');
        }

        return this.MOODLE_URL;
    }

    /**
     * Retrieve basic site info from Moodle to verify connectivity.
     * Exposes a small wrapper around the generic request for controller use.
     */
    async getSiteInfo(): Promise<unknown> {
        return await this.request('core_webservice_get_site_info');
    }

    /**
     * Sync members of a Moodle group by fetching Moodle group members and
     * updating each corresponding local user/group record one-by-one.
     * This performs per-user updates (no single big transaction) so failures
     * on individual users do not abort the whole operation.
     */
    async syncMoodleGroupMembers(moodleGroupId: number): Promise<ImportResult> {
        const errors: Array<{ userId?: number; username?: string; error: string }> = [];
        let updated = 0;

        // Find local group mapped to this Moodle group
        const localGroup = await this.groupRepository.findByMoodleId(moodleGroupId);
        if (!localGroup) {
            return {
                success: false,
                message: `Local group for Moodle id ${moodleGroupId} not found`,
                importedData: { groupId: null, usersImported: 0 },
            } as ImportResult;
        }

        // Get moodle users in group (calls Moodle API and returns detailed users)
        const moodleUsers = await this.getGroupUsers(moodleGroupId);

        // ALSO fetch enrolled users (once) for the parent course to obtain roles in bulk.
        // getEnrolledUsers returns users with roles; we map them by Moodle id to avoid
        // calling the enrolled API per-user inside the loop. We also keep the parent
        // course here so we can request per-user completion status when available.
        const enrolledRolesMap: Map<number, MoodleUser['roles']> = new Map();
        let parentCourse: { id_course?: number; moodle_id?: number } | null = null;
        try {
            parentCourse = localGroup.id_course ? await this.courseRepository.findById(localGroup.id_course) : null;
            if (parentCourse && parentCourse.moodle_id) {
                const enrolled = await this.getEnrolledUsers(parentCourse.moodle_id);
                for (const eu of enrolled) {
                    enrolledRolesMap.set(eu.id, eu.roles ?? []);
                }
            }
        } catch (err) {
            Logger.warn({ err, moodleGroupId }, 'MoodleService:syncMoodleGroupMembers - could not fetch enrolled users for role mapping');
            // proceed without enrolled roles map or parentCourse
        }

        for (const mu of moodleUsers) {
            try {
                // Update-only behavior: we only update existing local user and moodle_user
                // records. We do NOT create new users or alter group memberships here.
                const existingMoodleUser = await this.moodleUserService.findByMoodleId(mu.id);
                if (!existingMoodleUser) {
                    // No local mapping found: record and continue
                    errors.push({ userId: mu.id, username: mu.username, error: 'No local moodle_user mapping found' });
                    continue;
                }

                // Do NOT overwrite local user's personal data (name, surname, email) from Moodle.
                // Requirement: when a user already exists in local DB, preserve local personal fields.
                // We only update role (user_group) and moodle_username below. If you want to
                // sync personal data from Moodle, do it explicitly in a separate flow.

                // Update moodle_user record (username)
                try {
                    await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
                        moodle_username: mu.username,
                    });
                } catch (mErr: any) {
                    Logger.error({ mErr, moodleUserId: mu.id, localMoodleUserId: existingMoodleUser.id_moodle_user }, 'MoodleService:syncMoodleGroupMembers - moodle_user update failed');
                    throw mErr;
                }

                // Resolve and update role in user_group using roles provided by Moodle or
                // by the enrolled users map we fetched once above.
                try {
                    // Avoid casting to `any` — prefer a runtime check that `roles` is an array.
                    const muRoles = Array.isArray(mu.roles) ? mu.roles : undefined;
                    const rolesSource = (muRoles && muRoles.length > 0) ? muRoles : enrolledRolesMap.get(mu.id);
                    if (rolesSource && rolesSource.length > 0) {
                        const shortname = rolesSource[0].shortname;
                        if (shortname) {
                            const roleIdToAssign = await this.userGroupRepository.findOrCreateRoleByShortname(shortname);
                            try {
                                // We assume the local user is already associated to the local group
                                await this.userGroupRepository.updateById(existingMoodleUser.id_user, localGroup.id_group, { id_role: roleIdToAssign });
                            } catch (err) {
                                Logger.error({ err, userId: existingMoodleUser.id_user, id_group: localGroup.id_group, roleIdToAssign }, 'MoodleService:syncMoodleGroupMembers - update role failed');
                                // Do not block overall sync for role update failures
                            }
                        }
                    }
                } catch (roleErr) {
                    Logger.warn({ roleErr, moodleUserId: mu.id }, 'MoodleService:syncMoodleGroupMembers - role resolution failed');
                    // continue - role resolution failures shouldn't block user updates
                }

                // Additionally, if we have a parent course with a Moodle id, fetch the
                // user's completion percentage for that course and persist it on the
                // local user_group record. This keeps completion percentages in sync
                // when the operator clicks "Traer Moodle". Add debug logs and collect
                // per-user progress details for temporary tracing.
                try {
                    if (parentCourse && parentCourse.moodle_id) {
                        const progress = await this.getUserProgressInCourse(mu, parentCourse.moodle_id);
                        const completion = progress?.completion_percentage ?? null;

                        // Persist as string to match existing schema (e.g. "0", "75").
                        // If completion is null, persist '0' to avoid nulls in UI.
                        const completionValue = completion !== null && typeof completion !== 'undefined' ? String(completion) : '0';
                        try {
                            // Persist completion percentage in the user_course table (where UI reads it from)
                            await this.userCourseRepository.updateById(existingMoodleUser.id_user, localGroup.id_course, { completion_percentage: completionValue });
                        } catch (upErr: unknown) {
                            // Sanitize unknown error for logging: prefer Error properties when available
                            const errForLog = upErr instanceof Error ? { message: upErr.message, stack: upErr.stack } : String(upErr);
                            Logger.warn({ upErr: errForLog, userId: existingMoodleUser.id_user, id_course: localGroup.id_course }, 'MoodleService:syncMoodleGroupMembers - could not persist completion_percentage to user_course');
                        }
                    } else {
                        // No parent course Moodle id: skip per-user progress fetch
                    }
                } catch (progErr: unknown) {
                    const progErrForLog = progErr instanceof Error ? { message: progErr.message, stack: progErr.stack } : String(progErr);
                    Logger.warn({ progErr: progErrForLog, moodleUserId: mu.id }, 'MoodleService:syncMoodleGroupMembers - could not fetch user progress');
                    // don't block overall sync on progress fetch failures
                }

                updated += 1;
            } catch (err) {
                const e: unknown = err;
                const errMsg = e instanceof Error ? e.message : String(e);
                errors.push({ userId: mu.id, username: mu.username, error: errMsg });
            }
        }

        const message = `Processed ${moodleUsers.length} members; updated ${updated}; errors ${errors.length}`;
        return {
            success: errors.length === 0,
            message,
            importedData: { groupId: localGroup.id_group, usersImported: moodleUsers.length },
            details: errors,
        } as ImportResult;
    }


    async getAllUsers(): Promise<MoodleUser[]> {
        // Primero obtener usuarios básicos para obtener los IDs
        const basicData = await this.request<{ users: Array<{ id: number }> }>('core_user_get_users', {
            params: {
                criteria: [
                    {
                        key: 'deleted',
                        value: '0'
                    }
                ]
            }
        });

        const userIds = basicData.users.map(user => user.id);

        // Ahora obtener usuarios detallados con customfields usando core_user_get_users_by_field
        // Para evitar URIs o bodies demasiado grandes, procesamos en lotes (chunks)
        const chunkSize = 200; // tamaño razonable por petición
        const detailedUsers: MoodleUser[] = [];

        const chunks: number[][] = [];
        for (let i = 0; i < userIds.length; i += chunkSize) {
            chunks.push(userIds.slice(i, i + chunkSize));
        }

        for (const chunk of chunks) {
            try {
                const batch = await this.request<Array<MoodleUser>>('core_user_get_users_by_field', {
                    params: {
                        field: 'id',
                        values: chunk
                    },
                    method: 'post'
                });
                if (Array.isArray(batch)) detailedUsers.push(...batch);
            } catch (err) {
                // Log and continue with next chunk
                Logger.error({ err, chunkLength: chunk.length }, 'MoodleService:getAllUsers - chunk failed');
            }
        }

        // Verificar si tienen customfields (puede ser útil en callers)
        //const usersWithCustomFields = detailedUsers.filter(user => user.customfields && user.customfields.length > 0);

        return detailedUsers;
    }

    async getUserById(userId: number): Promise<MoodleUser> {
        const data = await this.request<Array<MoodleUser>>('core_user_get_users_by_field', {
            params: {
                field: 'id',
                values: [userId]
            }
        });

        if (data.length === 0) {
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        }

        return data[0];
    }

    async getAllCourses(): Promise<MoodleCourse[]> {
        const data = await this.request<Array<MoodleCourse>>('core_course_get_courses');
        return data;
    }

    async getCourseGroups(courseId: number): Promise<MoodleGroup[]> {
        const data = await this.request<Array<MoodleGroup>>('core_group_get_course_groups', {
            params: {
                courseid: courseId
            }
        });

        return data;
    }

    /**
     * Este método hace una solicitud a la API 'core_group_get_group_members' para obtener los IDs de los miembros
     * del grupo especificado. Luego, obtiene los detalles de cada usuario por su ID utilizando el método `getUserById`.
     */
    async getGroupUsers(groupId: number): Promise<MoodleUser[]> {
        const data = await this.request<Array<{ groupid: number, userids: number[] }>>('core_group_get_group_members', {
            params: {
                groupids: [groupId]
            }
        });

        const userIds = data.find(group => group.groupid === groupId)?.userids || [];
        const users = [];
        for (const userId of userIds) {
            const user = await this.getUserById(userId);
            users.push(user);
        }
        return users;
    }

    async getEnrolledUsers(courseId: number): Promise<MoodleUser[]> {
        const data = await this.request<Array<MoodleUser>>('core_enrol_get_enrolled_users', {
            params: {
                courseid: courseId
            }
        });

        return data.map(user => ({
            ...user,
            roles: user.roles.map(role => ({
                roleid: role.roleid,
                name: role.name,
                shortname: role.shortname,
                sortorder: role.sortorder
            }))
        }));
    }

    /**
     * Obtiene el progreso de un usuario en un curso específico.
     * @param user Usuario de Moodle
     * @param courseId ID del curso
     * @returns ExtendedMoodleUser con completion_percentage y time_spent
     */
    /* TODO: Quizás sea mejor intregrarla en getEnroledUsers */
    async getUserProgressInCourse(user: MoodleUser, courseId: number): Promise<ExtendedMoodleUser> {
        // Typings for the completion API response (we only care about these fields here)
        type CompletionActivity = {
            // state: 0 = not completed, other values mean completed in Moodle's response
            state: number;
            // valueused indicates whether the activity counts for completion calculation
            valueused?: boolean;
        };

        interface CompletionResponse {
            statuses?: CompletionActivity[];
        }

        const completionData = await this.request<CompletionResponse>('core_completion_get_activities_completion_status', {
            params: {
                courseid: courseId,
                userid: user.id
            }
        });

        const activities: CompletionActivity[] = completionData.statuses || [];
        const usedActivities = activities.filter((activity: CompletionActivity) => activity.valueused === true);
        const completed = usedActivities.filter((activity: CompletionActivity) => activity.state !== 0).length;
        const total = usedActivities.length;
        const completion_percentage = total > 0 ? Math.round((completed / total) * 100) : null;

        return {
            ...user,
            roles: Array.isArray(user.roles) ? user.roles.map(role => ({
                roleid: role.roleid,
                name: role.name,
                shortname: role.shortname,
                sortorder: role.sortorder
            })) : [],
            completion_percentage,
            time_spent: null // Moodle estándar no lo proporciona, hace falta un plugin como block_dedication
        };
    }

    async getCourseUserProfiles(courseId: number, userId: number): Promise<MoodleUser[]> {
        const data = await this.request<Array<MoodleUser>>('core_user_get_course_user_profiles', {
            params: {
                userlist: [{ courseid: courseId, userid: userId }]
            }
        });

        return data;
    }

    /**
     * Descarga todos los usuarios desde Moodle y actualiza los moodle_usernames
     * locales cuando existe coinicidencia por moodle_id.
     */
    async syncUsernamesFromMoodle(options?: QueryOptions) {
        // Validate Moodle configuration early (DB-first)
        const [resolvedUrl, resolvedToken] = await Promise.all([this.resolveMoodleUrl(), this.resolveMoodleToken()]);
        if (!resolvedUrl || !resolvedToken) {
            throw new InternalServerErrorException('Moodle URL or token not configured');
        }

        // First, download users from Moodle (may throw a Moodle-related error)
        let moodleUsers: MoodleUser[];
        try {
            moodleUsers = await this.getAllUsers();
        } catch (err) {
            Logger.error({ err }, 'MoodleService:syncUsernamesFromMoodle');
            throw new InternalServerErrorException('Error descargando usuarios desde Moodle');
        }

        // Now update local records inside a single transaction but tolerate per-record failures
        return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
            let updated = 0;
            const updatedIds: number[] = [];
            const errors: Array<{ moodleId?: number; id_moodle_user?: number; error: string }> = [];

            for (const mu of moodleUsers) {
                try {
                    const local = await this.moodleUserService.findByMoodleId(mu.id, { transaction });
                    if (!local) continue;

                    const newUsername = mu.username;
                    if (local.moodle_username === newUsername) continue;

                    try {
                        await this.moodleUserService.update(local.id_moodle_user, { moodle_username: newUsername }, { transaction });
                        updated++;
                        updatedIds.push(local.id_moodle_user);
                    } catch (err: any) {
                        Logger.error({ err, moodleId: mu.id, localId: local.id_moodle_user }, 'MoodleService:syncUsernamesFromMoodle - update failed');
                        errors.push({ moodleId: mu.id, id_moodle_user: local.id_moodle_user, error: err.message || String(err) });
                        // continue with next user
                    }
                } catch (err: any) {
                    Logger.error({ err, moodleId: mu.id }, 'MoodleService:syncUsernamesFromMoodle - find failed');
                    errors.push({ moodleId: mu.id, error: err.message || String(err) });
                }
            }

            return { totalMoodleUsers: moodleUsers.length, updated, updatedIds, errors };
        });
    }

    /**
     * OBTIENE LISTA DE CURSOS DE MOODLE CON ESTADO DE IMPORTACIÓN
     * 
     * Devuelve todos los cursos disponibles en Moodle junto con información
     * sobre si ya están importados en nuestra base de datos y cuándo fue la última importación
     */
    async getMoodleCoursesWithImportStatus(): Promise<MoodleCourseWithImportStatus[]> {
        return await this.databaseService.db.transaction(async transaction => {


            // Obtener todos los cursos de Moodle
            const moodleCourses = await this.getAllCourses();

            // Obtener todos los cursos ya importados de nuestra BD
            const importedCourses = await this.courseRepository.findAll({}, { transaction });

            // Crear un mapa para búsqueda rápida de cursos importados por moodle_id
            const importedCoursesMap = new Map();
            importedCourses.forEach(course => {
                if (course.moodle_id) {
                    importedCoursesMap.set(course.moodle_id, course);
                }
            });

            // Construir la respuesta con el estado de importación
            const coursesWithStatus: MoodleCourseWithImportStatus[] = moodleCourses
                .filter(moodleCourse => moodleCourse.id !== 1) // Filtrar curso del sistema
                .map(moodleCourse => {
                    const importedCourse = importedCoursesMap.get(moodleCourse.id);

                    return {
                        id: moodleCourse.id,
                        fullname: moodleCourse.fullname,
                        shortname: moodleCourse.shortname,
                        startdate: moodleCourse.startdate,
                        enddate: moodleCourse.enddate,
                        isImported: !!importedCourse,
                        lastImportDate: importedCourse?.updatedAt || importedCourse?.createdAt,
                        localCourseId: importedCourse?.id_course,
                    };
                });


            return coursesWithStatus;
        });
    }

    /**
     * OBTIENE LISTA DE GRUPOS DE UN CURSO DE MOODLE CON ESTADO DE IMPORTACIÓN
     */
    async getMoodleGroupsWithImportStatus(moodleCourseId: number): Promise<MoodleGroupWithImportStatus[]> {
        return await this.databaseService.db.transaction(async transaction => {


            // Obtener grupos del curso desde Moodle
            const moodleGroups = await this.getCourseGroups(moodleCourseId);

            // Buscar si el curso está importado para obtener su ID local
            const localCourse = await this.courseRepository.findByMoodleId(moodleCourseId, { transaction });
            let importedGroups = [];

            if (localCourse) {
                // Obtener grupos ya importados de nuestra BD para este curso
                importedGroups = await this.groupRepository.findGroupsByCourseId(localCourse.id_course, { transaction });
            }

            // Crear mapa para búsqueda rápida de grupos importados por moodle_id
            const importedGroupsMap = new Map();
            importedGroups.forEach(group => {
                if (group.moodle_id) {
                    importedGroupsMap.set(group.moodle_id, group);
                }
            });

            // Construir respuesta con estado de importación
            const groupsWithStatus: MoodleGroupWithImportStatus[] = moodleGroups.map(moodleGroup => {
                const importedGroup = importedGroupsMap.get(moodleGroup.id);

                return {
                    id: moodleGroup.id,
                    name: moodleGroup.name,
                    description: moodleGroup.description,
                    courseid: moodleGroup.courseid,
                    isImported: !!importedGroup,
                    lastImportDate: importedGroup?.updatedAt || importedGroup?.createdAt,
                    localGroupId: importedGroup?.id_group,
                };
            });


            return groupsWithStatus;
        });
    }

    /**
     * HELPER: Crear/actualizar curso de Moodle en BD local
     */
    private async upsertMoodleCourse(moodleCourse: MoodleCourse, options?: QueryOptions) {
        const run = async (transaction: Transaction) => {
            const data = {
                course_name: moodleCourse.fullname,
                short_name: moodleCourse.shortname,
                moodle_id: moodleCourse.id,
                start_date: new Date(moodleCourse.startdate * 1000),
                end_date: (moodleCourse.enddate && moodleCourse.enddate > 0) ? new Date(moodleCourse.enddate * 1000) : null,
                // Campos opcionales necesarios para la creación
                category: "",
                modality: CourseModality.ONLINE,
                hours: 0,
                price_per_hour: null,
                active: true,
                fundae_id: "",
            };
            const existingCourse = await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
            if (existingCourse) {
                await this.courseRepository.update(existingCourse.id_course, data, { transaction });
                return await this.courseRepository.findByMoodleId(moodleCourse.id, { transaction });
            } else {
                const [{ id }] = await this.courseRepository.create(data, { transaction });
                return await this.courseRepository.findById(id, { transaction });
            }
        };

        if (options?.transaction) return await run(options.transaction);
        return await this.databaseService.db.transaction(async transaction => await run(transaction));
    }

    /**
     * HELPER: Crear/actualizar usuario de Moodle e inscribirlo en curso
     */
    private async upsertMoodleUserAndEnrollToCourse(
        moodleUser: MoodleUser,
        courseId: number,
        options?: QueryOptions,
        completionPercentage?: number | null
    ) {
        const run = async (transaction: Transaction) => {
            let userId: number;
            let moodleUserId: number;
            try {
                // Buscar si ya existe un usuario de Moodle con este moodle_id
                let existingMoodleUser = null;
                try {
                    existingMoodleUser = await this.moodleUserService.findByMoodleId(moodleUser.id, { transaction });
                    // Logger.log({ existingMoodleUser }, 'findByMoodleId OK');
                } catch (err) {
                    Logger.error({ err, moodleUser }, 'findByMoodleId ERROR');
                    throw err;
                }

                if (existingMoodleUser) {
                    // Solo actualizar el username de Moodle
                    userId = existingMoodleUser.id_user;
                    moodleUserId = existingMoodleUser.id_moodle_user;
                    try {
                        await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
                            moodle_username: moodleUser.username,
                        }, { transaction });
                        // Logger.log({ userId, moodleUserId }, 'update MoodleUser OK');
                    } catch (err) {
                        Logger.error({ err, userId, moodleUser }, 'update MoodleUser ERROR');
                        throw err;
                    }
                } else {
                    // Intentar buscar usuario por DNI en customfields de Moodle
                    let foundUserByDni = null;
                    const dniField = moodleUser.customfields?.find(f => (f.shortname && f.shortname.toLowerCase() === 'dni') || (f.name && f.name.toLowerCase() === 'dni'));
                    if (dniField && dniField.value) {
                        try {
                            foundUserByDni = await this.userRepository.findByDni(dniField.value, { transaction });
                            // Logger.log({ foundUserByDni }, 'findByDni OK');
                        } catch (err) {
                            Logger.error({ err, dniField, moodleUser }, 'findByDni ERROR');
                            throw err;
                        }
                    }
                    if (foundUserByDni) {
                        // Asociar usuario de Moodle al usuario existente por DNI
                        userId = foundUserByDni.id_user;
                        try {
                            const moodleUserResult = await this.moodleUserService.create({
                                id_user: userId,
                                moodle_id: moodleUser.id,
                                moodle_username: moodleUser.username,
                            }, { transaction });
                            moodleUserId = moodleUserResult.insertId;
                            // Logger.log({ userId, moodleUserId }, 'create MoodleUser by DNI OK');
                        } catch (err) {
                            Logger.error({ err, userId, moodleUser }, 'create MoodleUser by DNI ERROR');
                            throw err;
                        }
                    } else {
                        // No existe usuario Moodle ni local por DNI: crear usuario local y registro Moodle
                        try {
                            const userResult = await this.userRepository.create({
                                name: moodleUser.firstname,
                                first_surname: moodleUser.lastname,
                                email: moodleUser.email,
                            } as UserInsertModel, { transaction });
                            userId = userResult.insertId;
                        } catch (err) {
                            Logger.error({ err, moodleUser }, 'create User ERROR');
                            throw err;
                        }

                        try {
                            const moodleUserResult = await this.moodleUserService.create({
                                id_user: userId,
                                moodle_id: moodleUser.id,
                                moodle_username: moodleUser.username,
                            }, { transaction });
                            moodleUserId = moodleUserResult.insertId;
                        } catch (err) {
                            Logger.error({ err, userId, moodleUser }, 'create MoodleUser for new user ERROR');
                            throw err;
                        }
                    }
                }

                // Crear/actualizar inscripción al curso
                const completionStr = completionPercentage !== null && completionPercentage !== undefined
                    ? completionPercentage.toString()
                    : undefined;

                const userCourseData: UserCourseInsertModel = {
                    id_user: userId,
                    id_course: courseId,
                    id_moodle_user: moodleUserId,
                    completion_percentage: completionStr,
                };
                try {
                    await this.userCourseRepository.addUserToCourse(userCourseData, { transaction });
                    // Logger.log({ userCourseData }, 'addUserToCourse OK');
                } catch (err) {
                    Logger.error({ err, userCourseData }, 'addUserToCourse ERROR');
                    throw err;
                }

                // Nota: el almacenamiento de roles por curso (user_course_moodle_role) se eliminó.
                // Los roles se resuelven y aplican al nivel de `user_group.id_role` cuando se importan grupos.

                return await this.userRepository.findById(userId, { transaction });
            } catch (error) {
                Logger.error({ error, moodleUser }, 'upsertMoodleUserAndEnrollToCourse:ERROR');
                throw error;
            }
        };

        if (options?.transaction) return await run(options.transaction);
        return await this.databaseService.db.transaction(async transaction => await run(transaction));
    }

    /**
     * IMPORTA UN CURSO ESPECÍFICO DE MOODLE
     * 
     * Importa un único curso con todos sus usuarios y grupos asociados
     */
    async importSpecificMoodleCourse(moodleCourseId: number): Promise<ImportResult> {
        return await this.databaseService.db.transaction(async transaction => {
            try {


                // Obtener datos del curso desde Moodle
                const moodleCourses = await this.getAllCourses();
                const moodleCourse = moodleCourses.find(course => course.id === moodleCourseId);

                if (!moodleCourse) {
                    throw new Error(`Curso con ID ${moodleCourseId} no encontrado en Moodle`);
                }



                // Crear/actualizar el curso
                const course = await this.upsertMoodleCourse(moodleCourse, { transaction });

                // Importar usuarios del curso

                const enrolledUsers = await this.getEnrolledUsers(moodleCourse.id);
                let usersImported = 0;

                for (const enrolledUser of enrolledUsers) {
                    if (enrolledUser.username === 'guest') {
                        await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                    } else {
                        try {
                            const progress = await this.getUserProgressInCourse(enrolledUser, moodleCourse.id);
                            // Log exhaustivo antes de guardar

                            // Forzar que nunca sea undefined
                            let completionPercentage = progress.completion_percentage;
                            if (completionPercentage === undefined) completionPercentage = null;
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, completionPercentage);
                        } catch (e) {
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                        }
                    }
                    usersImported++;
                }

                // Importar grupos del curso

                const moodleGroups = await this.getCourseGroups(moodleCourse.id);

                for (const moodleGroup of moodleGroups) {
                    const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });

                    const moodleUsers = await this.getGroupUsers(moodleGroup.id);
                    // If we have enrolledUsers earlier for this course, try to reuse their roles.
                    // Build a quick map from enrolled users fetched in this function scope if present.
                    // Note: when importSpecificMoodleCourse called getEnrolledUsers it stored them in `enrolledUsers`.
                    const enrolledRolesMapLocal: Map<number, MoodleUser['roles']> = new Map();
                    try {
                        // Try to fetch enrolled users for the course once (best-effort). If this function
                        // already called getEnrolledUsers for the course earlier, this will be redundant but safe.
                        const courseObj = await this.courseRepository.findById(course.id_course, { transaction });
                        if (courseObj && courseObj.moodle_id) {
                            const enrolledForCourse = await this.getEnrolledUsers(courseObj.moodle_id);
                            for (const eu of enrolledForCourse) enrolledRolesMapLocal.set(eu.id, eu.roles ?? []);
                        }
                    } catch (e) {
                        // best-effort: if this fails we continue without the map
                    }

                    for (const moodleUser of moodleUsers) {
                        // Prefer roles already present on the moodleUser payload; otherwise merge from map
                        if ((!moodleUser.roles || moodleUser.roles.length === 0) && enrolledRolesMapLocal.size > 0) {
                            const fromMap = enrolledRolesMapLocal.get(moodleUser.id);
                            if (fromMap && fromMap.length > 0) moodleUser.roles = fromMap;
                        }
                        await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                    }
                }



                return {
                    success: true,
                    message: `Curso "${moodleCourse.fullname}" importado correctamente`,
                    importedData: {
                        courseId: course.id_course,
                        usersImported,
                    }
                };

            } catch (error) {
                console.error('❌ Error durante la importación del curso:', error);
                return {
                    success: false,
                    message: 'Error durante la importación del curso',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                };
            }
        });
    }

    /**
     * IMPORTA UN GRUPO ESPECÍFICO DE MOODLE
     * 
     * Importa un grupo específico con todos sus usuarios
     */
    async importSpecificMoodleGroup(moodleGroupId: number): Promise<ImportResult> {
        return await this.databaseService.db.transaction(async transaction => {
            try {


                // Obtener información del grupo desde Moodle
                const moodleCourses = await this.getAllCourses();
                let moodleGroup = null;
                let parentCourse = null;

                // Buscar el grupo en todos los cursos
                for (const course of moodleCourses) {
                    if (course.id === 1) continue; // Saltar curso del sistema

                    const courseGroups = await this.getCourseGroups(course.id);
                    const foundGroup = courseGroups.find(group => group.id === moodleGroupId);

                    if (foundGroup) {
                        moodleGroup = foundGroup;
                        parentCourse = course;
                        break;
                    }
                }

                if (!moodleGroup || !parentCourse) {
                    throw new Error(`Grupo con ID ${moodleGroupId} no encontrado en Moodle`);
                }



                // Asegurarse de que el curso padre esté importado
                const course = await this.upsertMoodleCourse(parentCourse, { transaction });

                // Crear/actualizar el grupo
                const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });

                // Importar usuarios del grupo

                const moodleUsers = await this.getGroupUsers(moodleGroup.id);
                let usersImported = 0;

                // Build enrolled roles map for the parent course (merge into moodleUser when missing)
                const enrolledRolesMapForGroup: Map<number, MoodleUser['roles']> = new Map();
                try {
                    if (parentCourse && parentCourse.id) {
                        const enrolled = await this.getEnrolledUsers(parentCourse.id);
                        for (const eu of enrolled) enrolledRolesMapForGroup.set(eu.id, eu.roles ?? []);
                    }
                } catch (e) {
                    // non-fatal
                }

                for (const moodleUser of moodleUsers) {
                    if ((!moodleUser.roles || moodleUser.roles.length === 0) && enrolledRolesMapForGroup.size > 0) {
                        const fromMap = enrolledRolesMapForGroup.get(moodleUser.id);
                        if (fromMap && fromMap.length > 0) moodleUser.roles = fromMap;
                    }
                    await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                    let completionPercentage = null;
                    if (moodleUser.username !== 'guest') {
                        try {
                            const progress = await this.getUserProgressInCourse(moodleUser, parentCourse.id);
                            // Normalize completion_percentage which may be number or string in some flows
                            const normalizeCompletion = (v: unknown): number | null => {
                                if (v == null) return null;
                                if (typeof v === 'number') return Math.round(v);
                                if (typeof v === 'string') {
                                    const n = Number(v);
                                    return Number.isFinite(n) ? Math.round(n) : null;
                                }
                                return null;
                            };
                            completionPercentage = normalizeCompletion(progress.completion_percentage);
                        } catch (e) {
                            completionPercentage = null;
                        }
                    }
                    if (completionPercentage === undefined) completionPercentage = null;
                    await this.upsertMoodleUserAndEnrollToCourse(moodleUser, course.id_course, { transaction }, completionPercentage);
                    usersImported++;
                }



                return {
                    success: true,
                    message: `Grupo "${moodleGroup.name}" importado correctamente`,
                    importedData: {
                        groupId: newGroup.id_group,
                        usersImported,
                    }
                };

            } catch (error) {
                console.error('❌ Error durante la importación del grupo:', error);
                return {
                    success: false,
                    message: 'Error durante la importación del grupo',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                };
            }
        });
    }

    /**
     * Create or update a local group in Moodle.
     * If the local group has a `moodle_id` we will call the Moodle update webservice,
     * otherwise we will create the group in Moodle. After creation we persist the
     * returned Moodle group id in our local `groups` table (field `moodle_id`).
     */
    async pushLocalGroupToMoodle(id_group: number): Promise<{ success: boolean; moodleGroupId?: number; message?: string }> {
        // Load local group
        const localGroup = await this.groupRepository.findById(id_group);
        if (!localGroup) throw new HttpException('Local group not found', HttpStatus.NOT_FOUND);

        // Load parent course to obtain its moodle_id
        const course = await this.courseRepository.findById(localGroup.id_course);
        if (!course) throw new HttpException('Parent course not found', HttpStatus.BAD_REQUEST);
        if (!course.moodle_id) throw new HttpException('Parent course is not linked to Moodle (missing moodle_id)', HttpStatus.BAD_REQUEST);

        // Prepare Moodle params using explicit keys to match Moodle WS format
        // Note: `core_group_update_groups` does NOT accept `courseid` for updates,
        // so only include `courseid` when creating a new group.
        const baseKey = 'groups[0]';
        const params: MoodleParams = {};
        params[`${baseKey}[name]`] = localGroup.group_name || '';
        params[`${baseKey}[description]`] = localGroup.description ?? '';
        params[`${baseKey}[descriptionformat]`] = 1; // HTML

        try {
            if (localGroup.moodle_id) {
                // Update existing Moodle group
                params[`${baseKey}[id]`] = localGroup.moodle_id;
                // core_group_update_groups typically returns boolean true on success
                const res = await this.request<boolean, MoodleParams>('core_group_update_groups', { method: 'post', params });
                // If update succeeded, ensure moodle_id stays in DB (no change expected)
                await this.groupRepository.update(id_group, { moodle_id: localGroup.moodle_id });
                return { success: true, moodleGroupId: localGroup.moodle_id, message: 'Group updated in Moodle' };
            } else {
                // For creation we may need to use a custom plugin endpoint (itop_training) if enabled in organization settings
                const orgRow = await this.organizationRepository.findFirst();
                const itopEnabled = !!(orgRow && (orgRow.settings as any)?.plugins && (orgRow.settings as any).plugins.itop_training === true);

                if (itopEnabled) {
                    // Prepare params for the custom block_gestion_grupos_create_group_custom1
                    const fmtDate = (d?: Date | string | null) => {
                        if (!d) return '';
                        const dt = d instanceof Date ? d : new Date(String(d));
                        // Use local date parts (getDate/getMonth/getFullYear) instead of
                        // UTC getters to avoid timezone shifts that can subtract a day
                        // when converting to UTC (which previously caused the -1 day bug).
                        const day = String(dt.getDate()).padStart(2, '0');
                        const month = String(dt.getMonth() + 1).padStart(2, '0');
                        const year = String(dt.getFullYear());
                        return `${day}/${month}/${year}`;
                    };

                    const hours = course.hours !== undefined && course.hours !== null ? String(course.hours) : '';
                    const startdate = fmtDate(localGroup.start_date ?? course.start_date);
                    const enddate = fmtDate(localGroup.end_date ?? course.end_date);

                    const customParams: MoodleParams = {
                        courseid: course.moodle_id,
                        group: localGroup.group_name || '',
                        hours,
                        startdate,
                        enddate,
                    };

                    const res = await this.request<any, MoodleParams>('block_gestion_grupos_create_group_custom1', { method: 'post', params: customParams });

                    // Try to extract an id from response if present
                    let createdId: number | undefined;
                    if (res) {
                        if (typeof res === 'number') createdId = res;
                        else if (res.id) createdId = Number(res.id);
                        else if (res.groupid) createdId = Number(res.groupid);
                        else if (res.moodleid) createdId = Number(res.moodleid);
                        else if (Array.isArray(res) && res[0] && (res[0].id ?? res[0].groupid)) createdId = Number(res[0].id ?? res[0].groupid);
                    }

                    if (createdId) {
                        await this.groupRepository.update(id_group, { moodle_id: createdId });
                        return { success: true, moodleGroupId: createdId, message: 'Group created in Moodle (itop) and local record updated' };
                    }

                    // If plugin did not return an id, return success with raw response for debugging
                    return { success: true, message: `Group created via itop plugin; response: ${JSON.stringify(res)}` };
                }

                // Fallback: core_group_create_groups
                params[`${baseKey}[courseid]`] = course.moodle_id;
                // Create new Moodle group
                const res = await this.request<CreatedGroupResponseItem[], MoodleParams>('core_group_create_groups', { method: 'post', params });
                // Expecting an array with created groups containing `id` (or groupid/groupidnumber)
                const createdId = Array.isArray(res) && res[0] && (res[0].id ?? res[0].groupid ?? res[0].groupidnumber) ? (res[0].id ?? res[0].groupid ?? res[0].groupidnumber) : undefined;
                // If Moodle returns object with id property, try to use it; otherwise try common fallbacks
                if (!createdId) {
                    // If we can't determine id, still return success but do not persist
                    return { success: false, message: 'Moodle did not return created group id' };
                }

                // Persist moodle_id locally
                await this.groupRepository.update(id_group, { moodle_id: createdId });

                return { success: true, moodleGroupId: createdId, message: 'Group created in Moodle and local record updated' };
            }
        } catch (err: any) {
            Logger.error({ err, id_group }, 'MoodleService:pushLocalGroupToMoodle');
            throw new InternalServerErrorException(err?.message || 'Error creating/updating group in Moodle');
        }
    }

    /**
     * Delete a Moodle group identified by the local group id.
     * Calls Moodle WS to delete the group and clears local `moodle_id` if successful.
     */
    async deleteLocalGroupFromMoodle(id_group: number): Promise<{ success: boolean; moodleGroupId?: number; message?: string }> {
        const localGroup = await this.groupRepository.findById(id_group);
        if (!localGroup) throw new HttpException('Local group not found', HttpStatus.NOT_FOUND);
        if (!localGroup.moodle_id) throw new HttpException('Local group is not linked to Moodle', HttpStatus.BAD_REQUEST);

        const moodleId = localGroup.moodle_id;

        // Prepare params for core_group_delete_groups
        // Moodle expects an array of group ids under the key `groupids` (e.g. groupids[]=123)
        const params: MoodleParams = {};
        params['groupids'] = [moodleId];

        try {
            // Moodle typically returns true on success
            const res = await this.request<boolean, MoodleParams>('core_group_delete_groups', { method: 'post', params });
            // On success, clear local moodle_id so local DB reflects deletion
            await this.groupRepository.update(id_group, { moodle_id: null });
            return { success: true, moodleGroupId: moodleId, message: 'Group deleted in Moodle and local record updated' };
        } catch (err: any) {
            Logger.error({ err, id_group, moodleId }, 'MoodleService:deleteLocalGroupFromMoodle');
            throw new InternalServerErrorException(err?.message || 'Error deleting group in Moodle');
        }
    }

    /**
     * IMPORTA TODOS LOS CURSOS DE MOODLE Y SUS DATOS RELACIONADOS
     * 
     * Este método hace una sincronización completa entre Moodle y nuestra base de datos:
     * 1. Obtiene todos los cursos de Moodle
     * 2. Para cada curso: crea/actualiza el curso en nuestra BD
     * 3. Para cada curso: obtiene los usuarios matriculados y los sincroniza
     * 4. Para cada curso: obtiene los grupos y sus usuarios
     * 
     * Es como hacer una "foto" completa del estado actual de Moodle
     */
    async importMoodleCourses(skipUsers = false) {
        return await this.databaseService.db.transaction(async transaction => {
            // PASO 1: Obtener TODOS los cursos que existen en Moodle
            const moodleCourses = await this.getAllCourses();
            console.log(`\n[MOODLE IMPORT] Iniciando importación de ${moodleCourses.length} cursos...`);
            // PASO 2: Procesar cada curso uno por uno
            for (const moodleCourse of moodleCourses) {
                if (moodleCourse.id === 1) continue;
                console.log(`[MOODLE IMPORT] Importando curso: ${moodleCourse.fullname} (ID: ${moodleCourse.id})`);
                const course = await this.upsertMoodleCourse(moodleCourse, { transaction });
                // Prepare enrolled roles map for this course if we will process users
                let enrolledRolesMap: Map<number, MoodleUser['roles']> | undefined = undefined;
                if (!skipUsers) {
                    const enrolledUsers = await this.getEnrolledUsers(moodleCourse.id);
                    console.log(`  [MOODLE IMPORT]   Usuarios matriculados: ${enrolledUsers.length}`);
                    enrolledRolesMap = new Map<number, MoodleUser['roles']>();
                    let userCount = 0;
                    for (const enrolledUser of enrolledUsers) {
                        userCount++;
                        if (enrolledUser.username === 'guest') {
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                            continue;
                        }
                        try {
                            const progress = await this.getUserProgressInCourse(enrolledUser, moodleCourse.id);
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, progress.completion_percentage);
                        } catch (e) {
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                        }
                        // store roles for later group processing
                        enrolledRolesMap.set(enrolledUser.id, enrolledUser.roles ?? []);
                        if (userCount % 10 === 0) {
                            console.log(`    [MOODLE IMPORT]     Procesados ${userCount} usuarios...`);
                        }
                    }
                }
                const moodleGroups = await this.getCourseGroups(moodleCourse.id);
                console.log(`  [MOODLE IMPORT]   Grupos encontrados: ${moodleGroups.length}`);
                let groupCount = 0;
                for (const moodleGroup of moodleGroups) {
                    groupCount++;
                    console.log(`    [MOODLE IMPORT]     Importando grupo: ${moodleGroup.name} (ID: ${moodleGroup.id})`);
                    const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });
                    if (!skipUsers) {
                        const moodleUsers = await this.getGroupUsers(moodleGroup.id);
                        for (const moodleUser of moodleUsers) {
                            if (enrolledRolesMap && (!moodleUser.roles || moodleUser.roles.length === 0)) {
                                const fromMap = enrolledRolesMap.get(moodleUser.id);
                                if (fromMap && fromMap.length > 0) moodleUser.roles = fromMap;
                            }
                            await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                        }
                    }
                }
            }
            console.log(`[MOODLE IMPORT] Importación finalizada.`);
            return { message: skipUsers ? 'Cursos y grupos importados correctamente (sin usuarios)' : 'Cursos, grupos y usuarios importados y actualizados correctamente' };
        });
    }

    async importMoodleUsers(options?: QueryOptions) {
        return await (options?.transaction ?? this.databaseService.db).transaction(async transaction => {
            const moodleUsers = await this.getAllUsers();

            for (const moodleUser of moodleUsers) {
                // Buscar si ya existe un usuario de Moodle con este moodle_id
                const existingMoodleUser = await this.moodleUserService.findByMoodleId(moodleUser.id, { transaction });

                let userId: number;

                if (existingMoodleUser) {
                    // Si existe el usuario de Moodle, actualizamos el usuario principal y el usuario de Moodle
                    userId = existingMoodleUser.id_user;

                    // Actualizar usuario principal
                    await this.userRepository.update(userId, {
                        name: moodleUser.firstname,
                        first_surname: moodleUser.lastname,
                        email: moodleUser.email,
                    } as UserUpdateModel, { transaction });

                    // Actualizar usuario de Moodle
                    await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
                        moodle_username: moodleUser.username,
                    }, { transaction });

                } else {
                    // Si no existe, intentar buscar por DNI en los customfields de Moodle
                    let foundUserByDni = null;
                    const dniField = moodleUser.customfields?.find(f => (f.shortname && f.shortname.toLowerCase() === 'dni') || (f.name && f.name.toLowerCase() === 'dni'));
                    if (dniField && dniField.value) {
                        try {
                            foundUserByDni = await this.userRepository.findByDni(dniField.value, { transaction });
                        } catch (err) {
                            Logger.error({ err, dniField, moodleUser }, 'findByDni ERROR');
                            throw err;
                        }
                    }

                    if (foundUserByDni) {
                        // Asociar el usuario Moodle al usuario local existente por DNI
                        userId = foundUserByDni.id_user;
                        try {
                            await this.moodleUserService.create({
                                id_user: userId,
                                moodle_id: moodleUser.id,
                                moodle_username: moodleUser.username,
                            }, { transaction });
                        } catch (err) {
                            Logger.error({ err, userId, moodleUser }, 'create MoodleUser by DNI ERROR');
                            throw err;
                        }
                    } else {
                        // Crear nuevo usuario principal
                        const userResult = await this.userRepository.create({
                            name: moodleUser.firstname,
                            first_surname: moodleUser.lastname,
                            email: moodleUser.email,
                        } as UserInsertModel, { transaction });

                        userId = userResult.insertId;

                        // Crear usuario de Moodle asociado
                        await this.moodleUserService.create({
                            id_user: userId,
                            moodle_id: moodleUser.id,
                            moodle_username: moodleUser.username,
                        }, { transaction });
                    }
                }
            }

            return { message: 'Usuarios importados y actualizados correctamente' };
        });
    }

    async upsertMoodleUserByGroup(moodleUser: MoodleUser, id_group: number, options?: QueryOptions) {
        const run = async (transaction: Transaction) => {
            // Buscar si ya existe un usuario de Moodle con este moodle_id
            const existingMoodleUser = await this.moodleUserService.findByMoodleId(moodleUser.id, { transaction });

            let userId: number;

            if (existingMoodleUser) {
                // Si existe el usuario de Moodle, NO sobreescribimos los datos personales locales
                // (name, first_surname, email) con los valores desde Moodle. De acuerdo a la
                // nueva regla, cuando el usuario ya existe en la BD solo se deben actualizar
                // los campos relacionados con rol (user_group.id_role) y porcentaje
                // (user_course.completion_percentage). El username de Moodle sí se actualiza
                // porque es específico de Moodle.
                userId = existingMoodleUser.id_user;

                // Actualizar usuario de Moodle (solo username)
                await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
                    moodle_username: moodleUser.username,
                }, { transaction });

            } else {
                // Intentar buscar por DNI en customfields antes de crear usuario nuevo
                let foundUserByDni = null;
                const dniField = moodleUser.customfields?.find(f => (f.shortname && f.shortname.toLowerCase() === 'dni') || (f.name && f.name.toLowerCase() === 'dni'));
                if (dniField && dniField.value) {
                    try {
                        foundUserByDni = await this.userRepository.findByDni(dniField.value, { transaction });
                    } catch (err) {
                        Logger.error({ err, dniField, moodleUser }, 'findByDni ERROR');
                        throw err;
                    }
                }

                if (foundUserByDni) {
                    // Asociar usuario de Moodle al usuario local existente por DNI
                    userId = foundUserByDni.id_user;
                    await this.moodleUserService.create({
                        id_user: userId,
                        moodle_id: moodleUser.id,
                        moodle_username: moodleUser.username,
                    }, { transaction });
                } else {
                    // Crear nuevo usuario principal
                    const userResult = await this.userRepository.create({
                        name: moodleUser.firstname,
                        first_surname: moodleUser.lastname,
                        email: moodleUser.email,
                    } as UserInsertModel, { transaction });

                    userId = userResult.insertId;

                    // Crear usuario de Moodle asociado
                    await this.moodleUserService.create({
                        id_user: userId,
                        moodle_id: moodleUser.id,
                        moodle_username: moodleUser.username,
                    }, { transaction });
                }
            }

            // Verificar si el usuario ya está en el grupo
            const userGroupRows = await this.userGroupRepository.findUserInGroup(userId, id_group, { transaction });

            // Resolver rol desde Moodle (si viene) delegando al repositorio para mantener la lógica de BD
            // Nota: algunas llamadas a la API (p.ej. core_group_get_group_members -> getUserById)
            // no devuelven el array `roles`. En ese caso, intentamos obtener los roles
            // buscando al usuario entre los `enrolledUsers` del curso padre (vía core_enrol_get_enrolled_users).
            let roleIdToAssign: number | undefined = undefined;
            try {
                // Preferir roles ya presentes en el objeto recibido
                let rolesSource = moodleUser.roles;

                // NOTE: roles should be provided in `moodleUser.roles` by the caller to avoid
                // making an API call per user. If roles are not present, we will not attempt
                // to fetch enrolled users here (caller should supply them); this keeps the
                // function efficient for bulk imports.

                if (rolesSource && rolesSource.length > 0) {
                    const shortname = rolesSource[0].shortname;
                    if (shortname) {
                        roleIdToAssign = await this.userGroupRepository.findOrCreateRoleByShortname(shortname, { transaction });
                    }
                }
            } catch (e) {
                // No bloquear el flujo si hay un error resolviendo roles; dejamos role undefined
                Logger.warn({ e, moodleUserId: moodleUser.id }, 'MoodleService:upsertMoodleUserByGroup - role resolution failed');
            }

            if (userGroupRows.length <= 0) {
                // No existía: crear la asociación incluyendo el id_role resuelto (o el por defecto que gestione el repositorio)
                await this.groupService.addUserToGroup({ id_group, id_user: userId, id_role: roleIdToAssign }, { transaction });
            } else {
                // Ya existe la fila user_group: si viene un role resuelto y es distinto al actual, actualizarlo
                // `findUserInGroup` devuelve filas del `user_group`; tipamos el primer registro adecuadamente
                const existing: UserGroupSelectModel | undefined = userGroupRows[0] ?? undefined;
                if (typeof roleIdToAssign !== 'undefined' && existing?.id_role !== roleIdToAssign) {
                    try {
                        await this.userGroupRepository.updateById(userId, id_group, { id_role: roleIdToAssign }, { transaction });
                    } catch (err) {
                        Logger.error({ err, userId, id_group, roleIdToAssign }, 'MoodleService:upsertMoodleUserByGroup - update role failed');
                        // No bloquear el flujo por un fallo al actualizar el role en user_group
                    }
                }
            }
        };

        if (options?.transaction) return await run(options.transaction);
        return await this.databaseService.db.transaction(async transaction => await run(transaction));
    }
}
