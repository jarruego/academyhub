import { Injectable, HttpException, HttpStatus, InternalServerErrorException, Logger, Inject } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { decryptSecret, tryEncryptSecret } from '../../utils/crypto/secrets.util';
import { MoodleCourse } from 'src/types/moodle/course';
import { MoodleGroup, CreatedGroupResponseItem } from 'src/types/moodle/group';
import { MoodleUser, ExtendedMoodleUser } from 'src/types/moodle/user';
import { MoodleCourseWithImportStatus, MoodleGroupWithImportStatus, ImportResult } from 'src/dto/moodle/import.dto';
import { DatabaseService } from 'src/database/database.service';
import { organizationSettingsTable, OrganizationSettingsSelectModel } from 'src/database/schema/tables/organization_settings.table';
import { eq } from 'drizzle-orm';
import { resolveInsertId } from 'src/utils/db';
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
import { UserInsertModel, UserUpdateModel, UserSelectModel } from 'src/database/schema/tables/user.table';
import { MoodleUserInsertModel, MoodleUserSelectModel } from 'src/database/schema/tables/moodle_user.table';
import { UserGroupSelectModel } from 'src/database/schema/tables/user_group.table';
import { generatePassword } from 'src/utils/generate-password';
import { link } from 'fs';

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
    
    // ===== OPTIMIZACIÓN EGRESS: Cache para Moodle sync =====
    private progressCache: Map<string, number | null> = new Map();
    private readonly logger = new Logger(MoodleService.name);

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
                        // If array items are objects (e.g., users payload), encode as nested Moodle params:
                        // key[index][prop]=value — Moodle expects this structure for many WS functions.
                        if (v.length > 0 && v.every(item => item && typeof item === 'object')) {
                            for (let idx = 0; idx < v.length; idx++) {
                                const item = v[idx] as Record<string, unknown>;
                                for (const [prop, val] of Object.entries(item)) {
                                    if (Array.isArray(val)) {
                                        for (const sub of val) {
                                            body.append(`${k}[${idx}][${prop}][]`, String(sub));
                                        }
                                    } else if (val && typeof val === 'object') {
                                        body.append(`${k}[${idx}][${prop}]`, JSON.stringify(val));
                                    } else if (val !== undefined && val !== null) {
                                        body.append(`${k}[${idx}][${prop}]`, String(val));
                                    }
                                }
                            }
                        } else {
                            for (const item of v) {
                                if (item && typeof item === 'object') {
                                    body.append(`${k}[]`, JSON.stringify(item));
                                } else {
                                    body.append(`${k}[]`, String(item));
                                }
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
            let rows: OrganizationSettingsSelectModel[] = [];
            if (typeof centerId === 'number') {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).where(eq(organizationSettingsTable.center_id, centerId)).limit(1);
            } else {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).limit(1);
            }

            if (rows && rows.length > 0) {
                const row: OrganizationSettingsSelectModel = rows[0];
                const secrets = (row.encrypted_secrets ?? {}) as Record<string, unknown>;

                // Support multiple keys historically used for storing the token.
                const candidates = ['moodle_token', 'moodle_token_plain', 'moodleToken', 'moodle_token_encrypted', 'token'];
                for (const key of candidates) {
                    const enc: unknown = secrets[key];
                    if (enc !== undefined && enc !== null) {
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
                                    } catch (updErr: unknown) {
                                        Logger.warn({ updErr }, 'MoodleService:resolveMoodleToken - failed to persist encrypted token');
                                    }
                                    // Return decrypted value from the encrypted object to ensure consistent behavior
                                    return decryptSecret(encrypted);
                                }
                            } catch (err: unknown) {
                                Logger.warn({ err }, 'MoodleService:resolveMoodleToken - encryption attempt failed; falling back to plaintext');
                                return enc;
                            }
                            return enc;
                        }
                        try {
                            return decryptSecret(enc);
                        } catch (err: unknown) {
                            Logger.warn({ err, key }, `MoodleService:resolveMoodleToken - failed to decrypt token for key=${key}; trying next`);
                        }
                    }
                }

                // Also support nested shape like { moodle: { token: '...' } }
                const maybeMoodle = secrets['moodle'];
                if (maybeMoodle && typeof maybeMoodle === 'object') {
                    const nested = (maybeMoodle as Record<string, unknown>)['token'];
                    if (nested) {
                        if (typeof nested === 'string') return nested;
                        try {
                            return decryptSecret(nested);
                        } catch (err: unknown) {
                            Logger.warn({ err }, 'MoodleService:resolveMoodleToken - failed to decrypt nested token');
                        }
                    }
                }
            }
        } catch (err: unknown) {
            Logger.warn({ err }, 'MoodleService:resolveMoodleToken - DB lookup failed, falling back to env');
        }

        return this.MOODLE_TOKEN;
    }

    /**
     * Resolve the Moodle URL. Priority: DB encrypted_secrets.moodle_url -> settings.moodle.url -> process.env.MOODLE_URL
     * Accepts encrypted URL objects (same shape as for tokens) and will attempt to decrypt them.
     */
    private async resolveMoodleUrl(centerId?: number): Promise<string | undefined> {
        try {
            let rows: OrganizationSettingsSelectModel[] = [];
            if (typeof centerId === 'number') {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).where(eq(organizationSettingsTable.center_id, centerId)).limit(1);
            } else {
                rows = await this.databaseService.db.select().from(organizationSettingsTable).limit(1);
            }

            if (rows && rows.length > 0) {
                const row: OrganizationSettingsSelectModel = rows[0];
                const maybeEncrypted = row.encrypted_secrets;
                const enc = (maybeEncrypted && typeof maybeEncrypted === 'object') ? (maybeEncrypted as Record<string, unknown>)['moodle_url'] : undefined;
                if (enc !== undefined && enc !== null) {
                    if (typeof enc === 'string') return enc;
                    try {
                        return decryptSecret(enc);
                    } catch (err: unknown) {
                        Logger.warn({ err }, 'MoodleService:resolveMoodleUrl - failed to decrypt url; falling back to settings/env');
                    }
                }

                // Try settings.moodle.url or a couple of common alternatives
                const s = (row.settings ?? {}) as Record<string, unknown>;
                const maybeMoodle = s['moodle'];
                if (maybeMoodle && typeof maybeMoodle === 'object') {
                    const url = (maybeMoodle as Record<string, unknown>)['url'];
                    if (typeof url === 'string') return url;
                }
                const alt1 = s['moodle_url'];
                if (typeof alt1 === 'string') return alt1;
                const alt2 = s['moodleUrl'];
                if (typeof alt2 === 'string') return alt2;
            }
        } catch (err: unknown) {
            Logger.warn({ err }, 'MoodleService:resolveMoodleUrl - DB lookup failed, falling back to env');
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
     * ===== OPTIMIZACIÓN EGRESS =====
     * Precarga el progreso de todos los usuarios para un curso en bulk
     * en lugar de hacer queries individuales (evita N+1 queries)
     */
    private async preloadCourseProgress(courseId: number, userIds: number[]): Promise<void> {
        if (userIds.length === 0 || !courseId) return;
        
        const startTime = Date.now();
        this.logger.log(`🚀 Precargando progreso para ${userIds.length} usuarios en curso ${courseId}...`);

        try {
            // Fetch progress para cada usuario y cachear
            let processed = 0;
            for (const userId of userIds) {
                try {
                    const progress = await this.getUserProgressInCourse({ id: userId } as MoodleUser, courseId);
                    const cacheKey = `progress:${courseId}:${userId}`;
                    this.progressCache.set(cacheKey, progress?.completion_percentage ?? null);
                    processed++;
                } catch (err) {
                    // Log pero no bloquear - usar valor por defecto si falla
                    this.logger.debug(`No progress found for user ${userId} in course ${courseId}`);
                    const cacheKey = `progress:${courseId}:${userId}`;
                    this.progressCache.set(cacheKey, null);
                }
            }
            
            const elapsed = Date.now() - startTime;
            this.logger.log(`✅ Precarga de progreso completada: ${processed}/${userIds.length} en ${elapsed}ms`);
        } catch (error) {
            this.logger.error(`❌ Error en precarga de progreso: ${error instanceof Error ? error.message : String(error)}`);
            // No lanzar error, continuar con queries normales
        }
    }

    /**
     * Obtiene progreso del cache si está disponible, sino lo fetch normalmente
     */
    private async getProgressOptimized(userId: number, courseId: number): Promise<number | null> {
        const cacheKey = `progress:${courseId}:${userId}`;
        
        // Buscar en cache
        if (this.progressCache.has(cacheKey)) {
            return this.progressCache.get(cacheKey) ?? null;
        }

        // Si no está en cache, hacer query y cachear
        try {
            const progress = await this.getUserProgressInCourse({ id: userId } as MoodleUser, courseId);
            this.progressCache.set(cacheKey, progress?.completion_percentage ?? null);
            return progress?.completion_percentage ?? null;
        } catch (err) {
            this.logger.debug(`Could not fetch progress for user ${userId}`);
            this.progressCache.set(cacheKey, null);
            return null;
        }
    }

    /**
     * Returns true when organization settings enable the itop_training plugin.
     */
    private async isItopTrainingEnabled(): Promise<boolean> {
        try {
            const orgRow = await this.organizationRepository.findFirst();
            if (!orgRow) return false;
            const settings = orgRow.settings ?? {};
            const plugins = (settings && typeof settings === 'object') ? (settings as Record<string, unknown>)['plugins'] : undefined;
            return !!(plugins && typeof plugins === 'object' && (plugins as Record<string, unknown>)['itop_training'] === true);
        } catch (err) {
            this.logger.warn({ err }, 'MoodleService:isItopTrainingEnabled - failed to read organization settings');
            return false;
        }
    }

    /**
     * Fetch user stats from the custom block_advanced_reports API.
     * Returns a map keyed by moodle user id with numeric values.
     */
    private async getAdvancedReportsUserStats(courseId: number, stat: string, groupId?: number): Promise<Map<number, number>> {
        const params: MoodleParams = { courseid: courseId, stat };
        if (groupId) params['groupid'] = groupId;

        const raw = await this.request<unknown>('block_advanced_reports_get_userstats', { params, method: 'post' });

        const debugEnabled = String(process.env.DEBUG_MOODLE_STATS ?? '').toLowerCase() === 'true';
        if (debugEnabled) {
            const rawKeys = (raw && typeof raw === 'object') ? Object.keys(raw as Record<string, unknown>) : undefined;
            this.logger.log({ courseId, stat, groupId, rawType: typeof raw, rawKeys }, 'MoodleService:getAdvancedReportsUserStats - raw response meta');
        }

        const candidates: unknown[] = [];
        if (Array.isArray(raw)) candidates.push(...raw);
        if (raw && typeof raw === 'object') {
            const r = raw as Record<string, unknown>;
            if (Array.isArray(r.data)) candidates.push(...r.data);
            if (Array.isArray(r.users)) candidates.push(...r.users);
            if (Array.isArray(r.results)) candidates.push(...r.results);
            if (Array.isArray(r.stats)) candidates.push(...r.stats);

            // Shallow recursive scan for array values in nested objects
            const scanArrays = (obj: Record<string, unknown>, depth: number) => {
                if (depth <= 0) return;
                for (const val of Object.values(obj)) {
                    if (Array.isArray(val)) {
                        candidates.push(...val);
                    } else if (val && typeof val === 'object') {
                        scanArrays(val as Record<string, unknown>, depth - 1);
                    }
                }
            };
            scanArrays(r, 2);
        }

        const map = new Map<number, number>();
        const parseTimeStringToSeconds = (input: unknown): number | null => {
            if (typeof input !== 'string') return null;
            const str = input.trim();
            if (!str) return null;
            // Accept formats like "06h 14m 24s" or "6h" or "14m" or "24s"
            const match = /(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/i.exec(str);
            if (!match) return null;
            const h = match[1] ? Number(match[1]) : 0;
            const m = match[2] ? Number(match[2]) : 0;
            const s = match[3] ? Number(match[3]) : 0;
            if (![h, m, s].every(n => Number.isFinite(n))) return null;
            return (h * 3600) + (m * 60) + s;
        };
        let parsed = 0;
        let invalid = 0;
        for (const item of candidates) {
            if (!item || typeof item !== 'object') continue;
            const row = item as Record<string, unknown>;
            const userIdRaw = row.userid ?? row.user_id ?? row.id ?? row.moodleid ?? row.moodle_user_id;
            const valueRaw = row.value ?? row.statvalue ?? row.time_spent ?? row[stat];
            const userId = Number(userIdRaw);
            const parsedValue = Number(valueRaw);
            const value = Number.isFinite(parsedValue) ? parsedValue : (parseTimeStringToSeconds(valueRaw) ?? NaN);
            if (Number.isFinite(userId) && Number.isFinite(value)) {
                map.set(userId, value);
                parsed += 1;
            } else {
                invalid += 1;
                if (debugEnabled && invalid <= 5) {
                    this.logger.warn({ sample: row, userIdRaw, valueRaw }, 'MoodleService:getAdvancedReportsUserStats - unparsed row');
                }
            }
        }

        // Fallback: handle map-like objects (userid -> value)
        if (map.size === 0 && raw && typeof raw === 'object') {
            const entries = Object.entries(raw as Record<string, unknown>);
            let mapped = 0;
            for (const [k, v] of entries) {
                const userId = Number(k);
                const value = Number(v);
                if (Number.isFinite(userId) && Number.isFinite(value)) {
                    map.set(userId, value);
                    mapped += 1;
                }
            }
            if (debugEnabled && mapped > 0) {
                this.logger.log({ courseId, stat, groupId, mapped }, 'MoodleService:getAdvancedReportsUserStats - parsed map-like response');
            }
        }

        if (debugEnabled) {
            this.logger.log({ courseId, stat, groupId, candidates: candidates.length, parsed, invalid, mapSize: map.size }, 'MoodleService:getAdvancedReportsUserStats - parsed summary');
            if (candidates.length === 0) {
                try {
                    const rawJson = JSON.stringify(raw);
                    const sample = rawJson.length > 2000 ? `${rawJson.slice(0, 2000)}...` : rawJson;
                    this.logger.warn({ courseId, stat, groupId, rawSample: sample }, 'MoodleService:getAdvancedReportsUserStats - raw payload sample (no candidates)');
                } catch (e) {
                    this.logger.warn({ courseId, stat, groupId }, 'MoodleService:getAdvancedReportsUserStats - raw payload not serializable');
                }
            }
        }

        return map;
    }

    /**
     * Sync members of a Moodle group by fetching Moodle group members and
     * updating each corresponding local user/group record one-by-one.
     * This performs per-user updates (no single big transaction) so failures
     * on individual users do not abort the whole operation.
     * 
     * ===== OPTIMIZACIÓN EGRESS =====
     * Ahora precarga el progreso de TODOS los usuarios en bulk antes del loop
     * en lugar de hacer queries individuales (evita N+1 queries masivo)
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
        let dedicationByUser: Map<number, number> | null = null;
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

        // ===== OPTIMIZACIÓN EGRESS: Precargar progreso de todos los usuarios =====
        if (parentCourse && parentCourse.moodle_id) {
            const userIds = moodleUsers.map(u => u.id);
            this.progressCache.clear(); // Limpiar cache anterior
            await this.preloadCourseProgress(parentCourse.moodle_id, userIds);

            const itopEnabled = await this.isItopTrainingEnabled();
            if (itopEnabled) {
                try {
                    dedicationByUser = await this.getAdvancedReportsUserStats(parentCourse.moodle_id, 'platformdedicationtime', moodleGroupId);
                } catch (err: unknown) {
                    const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
                    this.logger.warn({ err: errForLog, courseId: parentCourse.moodle_id, groupId: moodleGroupId }, 'MoodleService:syncMoodleGroupMembers - could not fetch platformdedicationtime');
                }
            } else {
                this.logger.log({ courseId: parentCourse.moodle_id, groupId: moodleGroupId }, 'MoodleService:syncMoodleGroupMembers - itop_training disabled, skipping time_spent sync');
            }
        }

        for (const mu of moodleUsers) {
            try {
                // First, ensure the Moodle user exists in local DB
                let existingMoodleUser = await this.moodleUserService.findByMoodleId(mu.id);
                
                if (!existingMoodleUser) {
                    // User doesn't exist: try to create/associate using upsertMoodleUserByGroup
                    // This will: 1) Look for existing user by DNI, 2) Create user if not found, 3) Associate with Moodle
                    try {
                        // Enrich roles in moodleUser from enrolled users map if not present
                        if ((!mu.roles || mu.roles.length === 0) && enrolledRolesMap.has(mu.id)) {
                            mu.roles = enrolledRolesMap.get(mu.id) ?? [];
                        }
                        
                        await this.upsertMoodleUserByGroup(mu, localGroup.id_group);
                        
                        // Reload the created user
                        existingMoodleUser = await this.moodleUserService.findByMoodleId(mu.id);
                        
                        if (!existingMoodleUser) {
                            // Still doesn't exist after creation attempt: record error and skip
                            errors.push({ userId: mu.id, username: mu.username, error: 'Failed to create or map moodle_user' });
                            continue;
                        }
                        
                        Logger.log({ moodleUserId: mu.id, username: mu.username }, 'MoodleService:syncMoodleGroupMembers - created new moodle_user mapping');
                    } catch (createErr: unknown) {
                        const createErrForLog = createErr instanceof Error ? { message: createErr.message, stack: createErr.stack } : String(createErr);
                        Logger.error({ createErr: createErrForLog, moodleUserId: mu.id, username: mu.username }, 'MoodleService:syncMoodleGroupMembers - failed to create moodle_user');
                        errors.push({ userId: mu.id, username: mu.username, error: 'Failed to create moodle_user: ' + (createErr instanceof Error ? createErr.message : String(createErr)) });
                        continue;
                    }
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
                } catch (mErr: unknown) {
                    const mErrForLog = mErr instanceof Error ? { message: mErr.message, stack: mErr.stack } : String(mErr);
                    Logger.error({ mErr: mErrForLog, moodleUserId: mu.id, localMoodleUserId: existingMoodleUser.id_moodle_user }, 'MoodleService:syncMoodleGroupMembers - moodle_user update failed');
                    errors.push({ userId: mu.id, username: mu.username, error: 'Failed to update moodle_username: ' + (mErr instanceof Error ? mErr.message : String(mErr)) });
                    continue; // Skip to next user instead of throwing
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
                        // ===== OPTIMIZACIÓN EGRESS =====
                        // Ahora usa cache en lugar de queries individuales por usuario
                        const completion = await this.getProgressOptimized(mu.id, parentCourse.moodle_id);

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

                        try {
                            // Keep user_group completion in sync for reports and group views
                            await this.userGroupRepository.updateById(existingMoodleUser.id_user, localGroup.id_group, { completion_percentage: completionValue });
                        } catch (upErr: unknown) {
                            const errForLog = upErr instanceof Error ? { message: upErr.message, stack: upErr.stack } : String(upErr);
                            Logger.warn({ upErr: errForLog, userId: existingMoodleUser.id_user, id_group: localGroup.id_group }, 'MoodleService:syncMoodleGroupMembers - could not persist completion_percentage to user_group');
                        }

                        if (dedicationByUser) {
                            const rawTime = dedicationByUser.get(mu.id);
                            if (rawTime !== undefined && rawTime !== null) {
                                const timeSpent = Math.max(0, Math.round(Number(rawTime)));
                                if (Number.isFinite(timeSpent)) {
                                    try {
                                        await this.userCourseRepository.updateById(existingMoodleUser.id_user, localGroup.id_course, { time_spent: timeSpent });
                                    } catch (upErr: unknown) {
                                        const errForLog = upErr instanceof Error ? { message: upErr.message, stack: upErr.stack } : String(upErr);
                                        Logger.warn({ upErr: errForLog, userId: existingMoodleUser.id_user, id_course: localGroup.id_course }, 'MoodleService:syncMoodleGroupMembers - could not persist time_spent to user_course');
                                    }

                                    try {
                                        await this.userGroupRepository.updateById(existingMoodleUser.id_user, localGroup.id_group, { time_spent: timeSpent });
                                    } catch (upErr: unknown) {
                                        const errForLog = upErr instanceof Error ? { message: upErr.message, stack: upErr.stack } : String(upErr);
                                        Logger.warn({ upErr: errForLog, userId: existingMoodleUser.id_user, id_group: localGroup.id_group }, 'MoodleService:syncMoodleGroupMembers - could not persist time_spent to user_group');
                                    }
                                }
                            }
                        }
                    } else {
                        // No parent course Moodle id: skip per-user progress fetch
                    }
                } catch (progErr: unknown) {
                    const progErrForLog = progErr instanceof Error ? { message: progErr.message, stack: progErr.stack } : String(progErr);
                    Logger.warn({ progErr: progErrForLog, moodleUserId: mu.id }, 'MoodleService:syncMoodleGroupMembers - could not fetch user progress');
                    // don't block overall sync on progress fetch failures

                                // Mark the user_group as synced (downloaded from Moodle)
                                try {
                                    await this.userGroupRepository.updateById(existingMoodleUser.id_user, localGroup.id_group, { moodle_synced_at: new Date() });
                                } catch (syncErr: unknown) {
                                    const errForLog = syncErr instanceof Error ? { message: syncErr.message, stack: syncErr.stack } : String(syncErr);
                                    Logger.warn({ syncErr: errForLog, userId: existingMoodleUser.id_user, groupId: localGroup.id_group }, 'MoodleService:syncMoodleGroupMembers - could not update moodle_synced_at');
                                }
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

    /**
     * Returns active courses (groups with end_date >= NOW() - 24h)
     * along with their active groups.
     */
    async getActiveCoursesProgress(): Promise<Array<{
        id_course: number;
        course_name: string;
        moodle_id: number | null;
        groups: Array<{
            id_group: number;
            group_name: string;
            moodle_id: number | null;
            end_date: Date | null;
        }>;
    }>> {
        const rows = await this.groupRepository.findActiveGroupsWithCourse();

        const courseMap = new Map<number, {
            id_course: number;
            course_name: string;
            moodle_id: number | null;
            groups: Array<{
                id_group: number;
                group_name: string;
                moodle_id: number | null;
                end_date: Date | null;
            }>;
        }>();

        for (const row of rows) {
            const course = row.course;
            const group = row.group;

            if (!courseMap.has(course.id_course)) {
                courseMap.set(course.id_course, {
                    id_course: course.id_course,
                    course_name: course.course_name,
                    moodle_id: course.moodle_id ?? null,
                    groups: [],
                });
            }

            const entry = courseMap.get(course.id_course)!;
            entry.groups.push({
                id_group: group.id_group,
                group_name: group.group_name,
                moodle_id: group.moodle_id ?? null,
                end_date: group.end_date ?? null,
            });
        }

        return Array.from(courseMap.values());
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
     * del grupo especificado. Luego, obtiene los detalles de usuarios en batch para mayor eficiencia.
     */
    async getGroupUsers(groupId: number): Promise<MoodleUser[]> {
        const data = await this.request<Array<{ groupid: number, userids: number[] }>>('core_group_get_group_members', {
            params: {
                groupids: [groupId]
            }
        });

        const userIds = data.find(group => group.groupid === groupId)?.userids || [];
        
        // Fetch user details in chunks to reduce API calls
        const chunkSize = 200;
        const chunks: number[][] = [];
        for (let i = 0; i < userIds.length; i += chunkSize) {
            chunks.push(userIds.slice(i, i + chunkSize));
        }

        const users: MoodleUser[] = [];
        for (const chunk of chunks) {
            try {
                const batch = await this.request<Array<MoodleUser>>('core_user_get_users_by_field', {
                    params: {
                        field: 'id',
                        values: chunk
                    },
                    method: 'post'
                });
                if (Array.isArray(batch)) users.push(...batch);
            } catch (err) {
                Logger.error({ err, chunkLength: chunk.length }, 'MoodleService:getGroupUsers - chunk failed');
            }
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
                    } catch (err: unknown) {
                        const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
                        Logger.error({ err: errForLog, moodleId: mu.id, localId: local.id_moodle_user }, 'MoodleService:syncUsernamesFromMoodle - update failed');
                        errors.push({ moodleId: mu.id, id_moodle_user: local.id_moodle_user, error: err instanceof Error ? err.message : String(err) });
                        // continue with next user
                    }
                } catch (err: unknown) {
                    const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
                    Logger.error({ err: errForLog, moodleId: mu.id }, 'MoodleService:syncUsernamesFromMoodle - find failed');
                    errors.push({ moodleId: mu.id, error: err instanceof Error ? err.message : String(err) });
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
                const created = await this.courseRepository.create(data, { transaction });
                const newId = resolveInsertId(created as unknown);
                if (!newId) throw new InternalServerErrorException('Failed to create course');
                return await this.courseRepository.findById(newId, { transaction });
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
                            moodleUserId = Number(resolveInsertId(moodleUserResult as unknown));
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
                            userId = Number(resolveInsertId(userResult as unknown));
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
                            moodleUserId = Number(resolveInsertId(moodleUserResult as unknown));
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
                let itopEnabled = false;
                if (orgRow) {
                    const settings = orgRow.settings ?? {};
                    const plugins = (settings && typeof settings === 'object') ? (settings as Record<string, unknown>)['plugins'] : undefined;
                    itopEnabled = !!(plugins && typeof plugins === 'object' && (plugins as Record<string, unknown>)['itop_training'] === true);
                }

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

                    const res = await this.request<unknown, MoodleParams>('block_gestion_grupos_create_group_custom1', { method: 'post', params: customParams });

                    // Try to extract an id from response if present (safe narrowing)
                    let createdId: number | undefined;
                    if (res !== undefined && res !== null) {
                        if (typeof res === 'number') {
                            createdId = res;
                        } else if (typeof res === 'string' && !Number.isNaN(Number(res))) {
                            createdId = Number(res);
                        } else if (typeof res === 'object') {
                            // object responses may include id, groupid, moodleid or be an array
                            const r = res as Record<string, unknown>;
                            if (r['id'] !== undefined && (typeof r['id'] === 'number' || typeof r['id'] === 'string')) createdId = Number(r['id']);
                            else if (r['groupid'] !== undefined && (typeof r['groupid'] === 'number' || typeof r['groupid'] === 'string')) createdId = Number(r['groupid']);
                            else if (r['moodleid'] !== undefined && (typeof r['moodleid'] === 'number' || typeof r['moodleid'] === 'string')) createdId = Number(r['moodleid']);
                            else if (Array.isArray(res) && res.length > 0 && typeof res[0] === 'object') {
                                const first = res[0] as Record<string, unknown>;
                                if (first['id'] !== undefined && (typeof first['id'] === 'number' || typeof first['id'] === 'string')) createdId = Number(first['id']);
                                else if (first['groupid'] !== undefined && (typeof first['groupid'] === 'number' || typeof first['groupid'] === 'string')) createdId = Number(first['groupid']);
                            }
                        }
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
        } catch (err: unknown) {
            const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
            Logger.error({ err: errForLog, id_group }, 'MoodleService:pushLocalGroupToMoodle');
            throw new InternalServerErrorException(err instanceof Error ? err.message : String(err) || 'Error creating/updating group in Moodle');
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
        } catch (err: unknown) {
            const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
            Logger.error({ err: errForLog, id_group, moodleId }, 'MoodleService:deleteLocalGroupFromMoodle');
            throw new InternalServerErrorException(err instanceof Error ? err.message : String(err) || 'Error deleting group in Moodle');
        }
    }

    /**
     * Ensure local users have corresponding Moodle accounts. For local users without a
     * mapping, create them in Moodle with `core_user_create_users` and persist the
     * resulting moodle_id/username/password in `moodle_users`.
     * Returns an array of mappings for all provided localUserIds that now have a Moodle id.
     */
    async upsertLocalUsersToMoodle(localUserIds: number[]): Promise<Array<{ localUserId: number; moodleId: number; id_moodle_user?: number }>> {
        const mappings: Array<{ localUserId: number; moodleId: number; id_moodle_user?: number }> = [];
    // Reuse the generated `UserSelectModel` and pick only the fields we need here
    type LocalUser = Pick<UserSelectModel, 'id_user' | 'name' | 'first_surname' | 'email' | 'dni'>;
        const toCreate: Array<{ localUserId: number; user: LocalUser; password: string }> = [];

        const ensureProfileInitialized = async (moodleUserId: number) => {
            try {
                await this.request('core_user_update_users', {
                    method: 'post',
                    params: {
                        users: [{ id: moodleUserId, description: '' }],
                    },
                });
            } catch (err: unknown) {
                const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
                Logger.warn({ err: errForLog, moodleUserId }, 'MoodleService:upsertLocalUsersToMoodle - failed to initialize description/format');
            }
        };

        // First, collect existing mappings and those missing
        for (const id_user of localUserIds) {
            try {
                const muRows: MoodleUserSelectModel[] = await this.moodleUserService.findByUserId(id_user);
                if (muRows && muRows.length > 0) {
                    const main = muRows.find((r) => r.is_main_user) || muRows[0];
                    if (main && main.moodle_id) mappings.push({ localUserId: id_user, moodleId: main.moodle_id, id_moodle_user: main.id_moodle_user });
                    else {
                        // treat as missing
                    }
                } else {
                    // fetch local user to prepare creation
                    const u = await this.userRepository.findById(id_user);
                    if (!u) continue;
                    // generate a password according to project rules
                    const pwd = generatePassword(8);
                    toCreate.push({ localUserId: id_user, user: u, password: pwd });
                }
            } catch (e) {
                Logger.warn({ e, id_user }, 'MoodleService:upsertLocalUsersToMoodle - findByUserId failed');
            }
        }

        if (toCreate.length === 0) return mappings;

    // Build Moodle payload for core_user_create_users
    const usersPayload: Array<Record<string, unknown>> = toCreate.map(tc => {
            const firstname = (tc.user.name || '').slice(0, 100) || 'User';
            const lastname = (tc.user.first_surname || '').slice(0, 100) || 'Surname';
            // username: prefer normalized dni (lowercase, alphanumeric) if available
            const normalizeDni = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            let username = '';
            if (tc.user.dni) {
                const n = normalizeDni(tc.user.dni);
                username = n.length > 0 ? n : '';
            }
            // fallback to email localpart or user_<id>
            if (!username) {
                if (tc.user.email && typeof tc.user.email === 'string' && tc.user.email.includes('@')) {
                    username = tc.user.email.split('@')[0] + '_' + tc.localUserId;
                } else {
                    username = 'user_' + tc.localUserId;
                }
            }
            // ensure username length and chars
            username = String(username).slice(0, 100);

            // generate a password according to rules if not already set
            const password = tc.password || generatePassword(8);

            return {
                username,
                password,
                firstname,
                lastname,
                email: tc.user.email || `${username}@example.local`,
                auth: 'manual',
                idnumber: tc.user.dni ?? '',
                description: '',
                city: '',
                country: '',
                lang: 'es',
                timezone: '99',
                mailformat: 1,
                maildisplay: 2,
                customfields: tc.user.dni ? [{ shortname: 'dni', value: String(tc.user.dni) }] : [],
            };
        });

        try {
            // First try a bulk creation (faster). If it succeeds, persist mappings.
            const created = await this.request<Array<{ id: number; username: string }>>('core_user_create_users', { method: 'post', params: { users: usersPayload } });
            if (Array.isArray(created)) {
                for (let i = 0; i < created.length; i++) {
                    const c = created[i];
                    const original = toCreate[i];
                    try {
                        if (c?.id) await ensureProfileInitialized(c.id);
                        const mu = await this.moodleUserService.create({ id_user: original.localUserId, moodle_id: c.id, moodle_username: c.username, moodle_password: original.password, is_main_user: true } as MoodleUserInsertModel);
                        const insertId = resolveInsertId(mu as unknown);
                        mappings.push({ localUserId: original.localUserId, moodleId: c.id, id_moodle_user: insertId ?? undefined });
                    } catch (innerErr) {
                        Logger.error({ innerErr, created: c, localUserId: original.localUserId }, 'MoodleService:upsertLocalUsersToMoodle - failed to persist moodle_user');
                    }
                }
            }
        } catch (err: unknown) {
            // Bulk creation failed. Try per-user creation with a simple username fallback strategy
            Logger.warn({ err, toCreateLength: toCreate.length }, 'MoodleService:upsertLocalUsersToMoodle - bulk create failed, falling back to per-user creation');
            for (const original of toCreate) {
                // reconstruct individual payload
                const firstname = (original.user.name || '').slice(0, 100) || 'User';
                const lastname = (original.user.first_surname || '').slice(0, 100) || 'Surname';
                const normalizeDni = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
                let username = '';
                if (original.user.dni) {
                    const n = normalizeDni(original.user.dni);
                    username = n.length > 0 ? n : '';
                }
                if (!username) {
                    if (original.user.email && typeof original.user.email === 'string' && original.user.email.includes('@')) {
                        username = original.user.email.split('@')[0] + '_' + original.localUserId;
                    } else {
                        username = 'user_' + original.localUserId;
                    }
                }
                username = String(username).slice(0, 100);

                const password = original.password;

                // Try original username, then one fallback attempt with _user appended
                const attempts = [username, `${username}_user`];
                let createdId: number | null = null;
                let createdUsername: string | null = null;
                for (const tryName of attempts) {
                    const payload = [{
                        username: tryName,
                        password,
                        firstname,
                        lastname,
                        email: original.user.email || `${tryName}@example.local`,
                        auth: 'manual',
                        idnumber: original.user.dni ?? '',
                        description: '',
                        city: '',
                        country: '',
                        lang: 'es',
                        timezone: '99',
                        mailformat: 1,
                        maildisplay: 2,
                        customfields: original.user.dni ? [{ shortname: 'dni', value: String(original.user.dni) }] : [],
                    }];
                    try {
                        const singleCreate = await this.request<Array<{ id: number; username: string }>>('core_user_create_users', { method: 'post', params: { users: payload } });
                        if (Array.isArray(singleCreate) && singleCreate.length > 0) {
                            createdId = singleCreate[0].id;
                            createdUsername = singleCreate[0].username;
                            break;
                        }
                    } catch (singleErr: unknown) {
                        // If error suggests username conflict, try next attempt. Otherwise log and continue to next user.
                        Logger.warn({ singleErr, localUserId: original.localUserId, tryName }, 'MoodleService:upsertLocalUsersToMoodle - per-user create failed');
                        // continue to next attempt
                    }
                }

                if (createdId && createdUsername) {
                    try {
                        await ensureProfileInitialized(createdId);
                        const mu = await this.moodleUserService.create({ id_user: original.localUserId, moodle_id: createdId, moodle_username: createdUsername, moodle_password: password, is_main_user: true } as MoodleUserInsertModel);
                        const insertId = resolveInsertId(mu as unknown);
                        mappings.push({ localUserId: original.localUserId, moodleId: createdId, id_moodle_user: insertId ?? undefined });
                    } catch (innerErr) {
                        Logger.error({ innerErr, createdId, createdUsername, localUserId: original.localUserId }, 'MoodleService:upsertLocalUsersToMoodle - failed to persist moodle_user after per-user create');
                    }
                } else {
                    Logger.error({ localUserId: original.localUserId }, 'MoodleService:upsertLocalUsersToMoodle - unable to create user in Moodle after retries');
                }
            }
        }

        return mappings;
    }

    /**
     * Preview which local users would be created in Moodle (do NOT create anything).
     * Returns an array of objects with suggested username/password for admin confirmation.
     */
    async getUsersToCreateInMoodle(localUserIds: number[]): Promise<Array<{ localUserId: number; name: string; email: string; suggestedUsername: string; suggestedPassword: string }>> {
        const preview: Array<{ localUserId: number; name: string; email: string; suggestedUsername: string; suggestedPassword: string }> = [];

        const normalizeDni = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

        for (const id_user of localUserIds) {
            try {
                const muRows = await this.moodleUserService.findByUserId(id_user);
                if (muRows && muRows.length > 0) continue; // Already has mapping
                const u = await this.userRepository.findById(id_user);
                if (!u) continue;
                // suggest username using same logic as creation
                let username = '';
                if (u.dni) {
                    const n = normalizeDni(u.dni);
                    username = n.length > 0 ? n : '';
                }
                if (!username) {
                    if (u.email && typeof u.email === 'string' && u.email.includes('@')) {
                        username = u.email.split('@')[0] + '_' + id_user;
                    } else {
                        username = 'user_' + id_user;
                    }
                }
                username = String(username).slice(0, 100);
                const pwd = generatePassword(8);
                preview.push({ localUserId: id_user, name: `${u.name ?? ''} ${u.first_surname ?? ''}`.trim(), email: u.email ?? '', suggestedUsername: username, suggestedPassword: pwd });
            } catch (err) {
                Logger.warn({ err, id_user }, 'MoodleService:getUsersToCreateInMoodle - preview failed for user');
            }
        }

        return preview;
    }

    /**
     * Update an existing Moodle user with current local data.
     * Requires that a moodle_users mapping exists for the local user and that
     * `moodle_id` is present. Calls Moodle's core_user_update_users webservice and
     * persists any username/password changes locally.
     */
    async updateLocalUserInMoodle(id_user: number): Promise<{ success: boolean; moodleId?: number; message?: string }> {
        // Ensure mapping exists
        const muRows = await this.moodleUserService.findByUserId(id_user);
        if (!muRows || muRows.length === 0) throw new HttpException('Local user is not linked to Moodle', HttpStatus.BAD_REQUEST);

        const main = muRows.find(r => r.is_main_user) || muRows[0];
        if (!main || !main.moodle_id) throw new HttpException('Local user has no moodle_id', HttpStatus.BAD_REQUEST);

        // Load local user
        const u = await this.userRepository.findById(id_user);
        if (!u) throw new HttpException('Local user not found', HttpStatus.NOT_FOUND);

        const normalizeDni = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // Build payload for core_user_update_users
        let username = main.moodle_username ?? '';
        if (!username) {
            if (u.dni) {
                const n = normalizeDni(u.dni);
                username = n.length > 0 ? n : '';
            }
            if (!username) {
                if (u.email && typeof u.email === 'string' && u.email.includes('@')) {
                    username = u.email.split('@')[0] + '_' + id_user;
                } else {
                    username = 'user_' + id_user;
                }
            }
        }
        username = String(username).slice(0, 100);

        const payload: Record<string, unknown> = {
            id: main.moodle_id,
            username,
            firstname: (u.name || '').slice(0, 100) || 'User',
            lastname: (u.first_surname || '').slice(0, 100) || 'Surname',
            email: u.email || `${username}@example.local`,
            idnumber: u.dni ?? ''
        };

        // Include password if we have one stored locally
        if (main.moodle_password) payload['password'] = main.moodle_password;

        try {
            // Moodle expects an array under `users` for core_user_update_users
            await this.request('core_user_update_users', { method: 'post', params: { users: [payload] } });

            // Persist possible changes to local moodle_user record (username/password)
            const updateData: Record<string, unknown> = {};
            if (payload.username && payload.username !== main.moodle_username) updateData['moodle_username'] = payload.username;
            if (payload.password && payload.password !== main.moodle_password) updateData['moodle_password'] = payload.password;
            if (Object.keys(updateData).length > 0 && main.id_moodle_user) {
                try {
                    await this.moodleUserService.update(main.id_moodle_user, updateData as any);
                } catch (innerErr) {
                    Logger.warn({ innerErr, id_user, id_moodle_user: main.id_moodle_user }, 'MoodleService:updateLocalUserInMoodle - failed to persist local moodle_user update');
                }
            }

            return { success: true, moodleId: main.moodle_id, message: 'User updated in Moodle' };
        } catch (err: unknown) {
            const errForLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
            Logger.error({ err: errForLog, id_user, moodleId: main.moodle_id }, 'MoodleService:updateLocalUserInMoodle');
            throw new InternalServerErrorException(err instanceof Error ? err.message : String(err) || 'Error updating user in Moodle');
        }
    }

    /**
     * Adds local users to the corresponding Moodle group.
     * If the local group has no moodle_id, it will be created first (pushLocalGroupToMoodle).
     * Returns an ImportResult-like object with per-user details for failures.
     */
    async addLocalUsersToMoodleGroup(id_group: number, userIds: number[]): Promise<ImportResult> {
        const details: Array<{ userId?: number; username?: string; error: string }> = [];
        let addedCount = 0;

        // Load local group
        const localGroup = await this.groupRepository.findById(id_group);
        if (!localGroup) throw new HttpException('Local group not found', HttpStatus.NOT_FOUND);

        // Ensure parent course exists and has moodle_id
        const course = await this.courseRepository.findById(localGroup.id_course);
        if (!course) throw new HttpException('Parent course not found', HttpStatus.BAD_REQUEST);
        if (!course.moodle_id) throw new HttpException('Parent course is not linked to Moodle (missing moodle_id)', HttpStatus.BAD_REQUEST);

        // Ensure group exists in Moodle
        let moodleGroupId = localGroup.moodle_id;
        if (!moodleGroupId) {
            const push = await this.pushLocalGroupToMoodle(id_group);
            if (!push || !push.success || !push.moodleGroupId) {
                return { success: false, message: 'Could not create group in Moodle before adding members', importedData: { groupId: id_group }, details } as ImportResult;
            }
            moodleGroupId = push.moodleGroupId;
        }

        // Map local userIds to Moodle userids (via moodle_users table)
        const members: { localUserId: number; moodleId: number; id_moodle_user?: number }[] = [];
        const missingIds: number[] = [];
        for (const id_user of userIds) {
            try {
                const muRows: MoodleUserSelectModel[] = await this.moodleUserService.findByUserId(id_user);
                if (!muRows || muRows.length === 0) {
                    missingIds.push(id_user);
                    continue;
                }
                const main = muRows.find((r) => r.is_main_user) || muRows[0];
                if (!main || !main.moodle_id) {
                    missingIds.push(id_user);
                    continue;
                }
                members.push({ localUserId: id_user, moodleId: main.moodle_id, id_moodle_user: main.id_moodle_user });
            } catch (err: unknown) {
                const ierr = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
                Logger.warn({ err: ierr, id_user }, 'MoodleService:addLocalUsersToMoodleGroup - findByUserId failed');
                missingIds.push(id_user);
            }
        }

        // Create missing Moodle users when possible
        if (missingIds.length > 0) {
            try {
                const created = await this.upsertLocalUsersToMoodle(missingIds);
                for (const c of created) {
                    members.push({ localUserId: c.localUserId, moodleId: c.moodleId, id_moodle_user: c.id_moodle_user });
                }
            } catch (e: unknown) {
                const ierr = e instanceof Error ? { message: e.message, stack: e.stack } : String(e);
                Logger.warn({ e: ierr, missingCount: missingIds.length }, 'MoodleService:addLocalUsersToMoodleGroup - failed creating missing Moodle users');
                for (const id of missingIds) details.push({ userId: id, error: 'No Moodle account linked for this user and creation failed' });
            }
        }

        if (members.length === 0) {
            return { success: false, message: 'No valid Moodle users to add', importedData: { groupId: id_group, usersImported: 0 }, details } as ImportResult;
        }

        // Ensure the users are enrolled in the parent course before attempting to add them to the group.
        // Moodle requires users to be enrolled in the course to be group members. We'll try to enroll missing users
        // using the manual enrol webservice. We perform a pre-check to avoid unnecessary enrol attempts.
        try {
            const enrolled = await this.getEnrolledUsers(course.moodle_id as number);
            const enrolledIds = new Set(enrolled.map(u => Number(u.id)));
            const toEnroll = members.filter(m => !enrolledIds.has(Number(m.moodleId)));
            if (toEnroll.length > 0) {
                // Resolve enrolment dates (prefer group dates, fallback to course dates)
                const toDate = (v?: Date | string | null) => {
                    if (!v) return null;
                    const dt = v instanceof Date ? v : new Date(String(v));
                    return Number.isNaN(dt.getTime()) ? null : dt;
                };
                const startDate = toDate(localGroup.start_date ?? course.start_date ?? null);
                const endDate = toDate(localGroup.end_date ?? course.end_date ?? null);
                const toUnixSeconds = (d: Date | null, endOfDay = false) => {
                    if (!d) return undefined;
                    const dt = new Date(d);
                    if (endOfDay) {
                        dt.setHours(23, 59, 59, 0);
                    } else {
                        dt.setHours(0, 0, 0, 0);
                    }
                    return Math.floor(dt.getTime() / 1000);
                };
                const enrolStart = toUnixSeconds(startDate, false);
                const enrolEnd = toUnixSeconds(endDate, true);

                const enrolParams: MoodleParams = {};
                // Use Moodle's manual enrol webservice. We'll use roleid=5 (student) by default.
                const STUDENT_ROLE_ID = 5;
                toEnroll.forEach((m, idx) => {
                    enrolParams[`enrolments[${idx}][roleid]`] = STUDENT_ROLE_ID;
                    enrolParams[`enrolments[${idx}][userid]`] = m.moodleId;
                    enrolParams[`enrolments[${idx}][courseid]`] = course.moodle_id;
                    if (enrolStart !== undefined) enrolParams[`enrolments[${idx}][timestart]`] = enrolStart;
                    if (enrolEnd !== undefined) enrolParams[`enrolments[${idx}][timeend]`] = enrolEnd;
                });

                try {
                    await this.request<boolean>('enrol_manual_enrol_users', { method: 'post', params: enrolParams });
                    // Persist enrollment locally: create or update user_course rows with id_moodle_user
                    for (const m of toEnroll) {
                        try {
                            // Ensure we persist the LOCAL moodle_users PK (id_moodle_user), not the remote Moodle id.
                            // m.moodleId is the remote Moodle user id (e.g. 19807). The user_course.id_moodle_user
                            // FK references moodle_users.id_moodle_user (local PK). Prefer the already-known
                            // m.id_moodle_user if present; otherwise try to look it up.
                            let localIdMoodleUser: number | undefined = undefined;
                            if (typeof m.id_moodle_user === 'number') {
                                localIdMoodleUser = Number(m.id_moodle_user);
                                } else {
                                try {
                                    const mu = await this.moodleUserService.findByMoodleId(Number(m.moodleId));
                                    if (mu && (mu as unknown as { id_moodle_user?: number }).id_moodle_user) localIdMoodleUser = (mu as unknown as { id_moodle_user?: number }).id_moodle_user;
                                } catch (findErr: unknown) {
                                    const ferr = findErr instanceof Error ? { message: findErr.message, stack: findErr.stack } : String(findErr);
                                    Logger.warn({ findErr: ferr, moodleId: m.moodleId, localUserId: m.localUserId }, 'MoodleService:addLocalUsersToMoodleGroup - could not find local moodle_user row for persisted moodle id');
                                }
                            }

                            if (!localIdMoodleUser) {
                                // If we still don't have a local id, skip persisting user_course to avoid FK violation
                                Logger.warn({ moodleId: m.moodleId, localUserId: m.localUserId }, 'MoodleService:addLocalUsersToMoodleGroup - skipping user_course persist because local moodle_users row not found');
                                continue;
                            }

                            const uc: UserCourseInsertModel = {
                                id_user: m.localUserId,
                                id_course: course.id_course,
                                id_moodle_user: Number(localIdMoodleUser),
                                enrollment_date: new Date(),
                                completion_percentage: '0',
                                time_spent: 0,
                            };
                            await this.userCourseRepository.addUserToCourse(uc);
                        } catch (ucErr: unknown) {
                            const uerr = ucErr instanceof Error ? { message: ucErr.message, stack: ucErr.stack } : String(ucErr);
                            Logger.warn({ ucErr: uerr, localUserId: m.localUserId, courseId: course.id_course }, 'MoodleService:addLocalUsersToMoodleGroup - failed to persist user_course enrollment');
                        }
                    }
                } catch (enrolErr: unknown) {
                    const eerr = enrolErr instanceof Error ? { message: enrolErr.message, stack: enrolErr.stack } : String(enrolErr);
                    Logger.warn({ enrolErr: eerr, toEnrollCount: toEnroll.length }, 'MoodleService:addLocalUsersToMoodleGroup - enrol_manual_enrol_users failed');
                    // continue — we'll still try to add to group individually below; failures will be captured
                }
            }
        } catch (e) {
            const errObj = e instanceof Error ? { message: e.message, stack: e.stack } : String(e);
            Logger.warn({ e: errObj }, 'MoodleService:addLocalUsersToMoodleGroup - failed to fetch enrolled users');
        }

        // Build members array for Moodle payload and diagnostic logging
    const membersPayload = members.map(m => ({ groupid: moodleGroupId as number, userid: m.moodleId }));

        // First attempt: send `members` as an array-of-objects and let request() encode it in Moodle's expected nested form.
        try {
            const paramsTry: MoodleParams = { members: membersPayload };
            const res = await this.request<boolean>('core_group_add_group_members', { method: 'post', params: paramsTry });

            // Persist membership locally for all successfully mapped users
            const addResult = await this.groupService.addUsersToGroup(id_group, members.map(m => m.localUserId));
            // Count both newly added and pre-existing memberships as synced for reporting
            const addedIds = addResult.addedIds || [];
            const existingIds = addResult.existingIds || [];
            addedCount = (addedIds.length ?? 0) + (existingIds.length ?? 0);
            // Mark local user_group rows as synced with Moodle for both newly added and existing users
                for (const userId of [...addedIds, ...existingIds]) {
                try {
                    await this.userGroupRepository.updateById(userId, id_group, { moodle_synced_at: new Date() });
                } catch (updErr: unknown) {
                    const uerr = updErr instanceof Error ? { message: updErr.message, stack: updErr.stack } : String(updErr);
                    Logger.warn({
                        message: uerr && typeof uerr === 'object' ? (uerr as { message?: string }).message : String(uerr),
                        stack: uerr && typeof uerr === 'object' ? (uerr as { stack?: string }).stack : undefined,
                        userId,
                        id_group
                    }, 'MoodleService:addLocalUsersToMoodleGroup - failed to set moodle_synced_at on user_group');
                }
            }
            for (const fid of addResult.failedIds || []) {
                details.push({ userId: fid, error: 'Failed to persist local membership' });
            }

            return {
                success: details.length === 0,
                message: `Added ${addedCount} users to Moodle group ${moodleGroupId}`,
                importedData: { groupId: id_group, usersImported: addedCount },
                details: details.length > 0 ? details : undefined,
            } as ImportResult;
        } catch (errArray: unknown) {
            const errForLog = errArray instanceof Error ? { message: errArray.message, stack: errArray.stack } : String(errArray);
            Logger.warn({ errArray: errForLog, membersLength: members.length, id_group }, 'MoodleService:addLocalUsersToMoodleGroup - bulk add (array-of-objects) failed, trying explicit keys');
            // Second attempt: try explicit members[0][groupid]=... encoding (older Moodle variants may expect this)
            const params: MoodleParams = {};
            members.forEach((m, idx) => {
                params[`members[${idx}][groupid]`] = moodleGroupId;
                params[`members[${idx}][userid]`] = m.moodleId;
            });
            try {
                const res2 = await this.request<boolean>('core_group_add_group_members', { method: 'post', params });

                const addResult = await this.groupService.addUsersToGroup(id_group, members.map(m => m.localUserId));
                const addedIds = addResult.addedIds || [];
                const existingIds = addResult.existingIds || [];
                addedCount = (addedIds.length ?? 0) + (existingIds.length ?? 0);
                // Mark local user_group rows as synced with Moodle for both newly added and existing users
                for (const userId of [...addedIds, ...existingIds]) {
                    try {
                        await this.userGroupRepository.updateById(userId, id_group, { moodle_synced_at: new Date() });
                    } catch (updErr: unknown) {
                        const uerr = updErr instanceof Error ? { message: updErr.message, stack: updErr.stack } : String(updErr);
                        Logger.warn({
                            message: uerr && typeof uerr === 'object' ? (uerr as { message?: string }).message : String(uerr),
                            stack: uerr && typeof uerr === 'object' ? (uerr as { stack?: string }).stack : undefined,
                            userId,
                            id_group
                        }, 'MoodleService:addLocalUsersToMoodleGroup - failed to set moodle_synced_at on user_group');
                    }
                }
                for (const fid of addResult.failedIds || []) {
                    details.push({ userId: fid, error: 'Failed to persist local membership' });
                }

                return {
                    success: details.length === 0,
                    message: `Added ${addedCount} users to Moodle group ${moodleGroupId}`,
                    importedData: { groupId: id_group, usersImported: addedCount },
                    details: details.length > 0 ? details : undefined,
                } as ImportResult;
            } catch (err: unknown) {
                const errLog = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
                Logger.warn({ err: errLog, membersLength: members.length, id_group }, 'MoodleService:addLocalUsersToMoodleGroup - bulk add failed, trying per-user');
                // Fallback: try per-user to identify which ones succeed
                for (const m of members) {
                    const singleParams: MoodleParams = {};
                    singleParams[`members[0][groupid]`] = moodleGroupId;
                    singleParams[`members[0][userid]`] = m.moodleId;
                    try {
                        await this.request<boolean>('core_group_add_group_members', { method: 'post', params: singleParams });
                        // Persist locally
                        try {
                            await this.groupService.addUserToGroup({ id_group, id_user: m.localUserId });
                            // mark as synced
                            try {
                                await this.userGroupRepository.updateById(m.localUserId, id_group, { moodle_synced_at: new Date() });
                            } catch (updErr: unknown) {
                                const uerr = updErr instanceof Error ? { message: updErr.message, stack: updErr.stack } : String(updErr);
                                Logger.warn({
                                    message: uerr && typeof uerr === 'object' ? (uerr as { message?: string }).message : String(uerr),
                                    stack: uerr && typeof uerr === 'object' ? (uerr as { stack?: string }).stack : undefined,
                                    localUserId: m.localUserId,
                                    id_group
                                }, 'MoodleService:addLocalUsersToMoodleGroup - failed to set moodle_synced_at on user_group (per-user)');
                            }
                            addedCount++;
                        } catch (localErr: unknown) {
                            const lmsg = localErr instanceof Error ? localErr.message : String(localErr);
                            details.push({ userId: m.localUserId, error: 'Added in Moodle but failed to persist locally: ' + lmsg });
                        }
                    } catch (singleErr: unknown) {
                        const serr = singleErr instanceof Error ? singleErr.message : String(singleErr);
                        details.push({ userId: m.localUserId, error: serr });
                    }
                }

                return {
                    success: addedCount > 0 && details.length === 0,
                    message: `Attempted adding users to Moodle group ${moodleGroupId}; added ${addedCount}, errors ${details.length}`,
                    importedData: { groupId: id_group, usersImported: addedCount },
                    details: details.length > 0 ? details : undefined,
                } as ImportResult;
            }
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

                                                userId = Number(resolveInsertId(userResult as unknown));

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

                                        userId = Number(resolveInsertId(userResult as unknown));

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