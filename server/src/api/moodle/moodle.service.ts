import { Injectable, HttpException, HttpStatus, InternalServerErrorException, Logger, Inject } from '@nestjs/common';
import axios from 'axios';
import { MoodleCourse } from 'src/types/moodle/course';
import { MoodleGroup } from 'src/types/moodle/group';
import { MoodleUser, ExtendedMoodleUser } from 'src/types/moodle/user';
import { MoodleCourseWithImportStatus, MoodleGroupWithImportStatus, ImportResult } from 'src/dto/moodle/import.dto';
import { DatabaseService } from 'src/database/database.service';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { QueryOptions, Transaction } from 'src/database/repository/repository';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { MoodleUserService } from '../moodle-user/moodle-user.service';
import { GroupService } from '../group/group.service';
import { userRolesTable } from 'src/database/schema/tables/user_roles.table';
import { eq } from 'drizzle-orm';
import { CourseModality } from 'src/types/course/course-modality.enum';
import { UserCourseInsertModel } from 'src/database/schema/tables/user_course.table';
import { UserInsertModel, UserUpdateModel } from 'src/database/schema/tables/user.table';

type RequestOptions<D> = {
    params?: D;
    method?: 'get' | 'post';
}



@Injectable()
export class MoodleService {
    private readonly MOODLE_URL = process.env.MOODLE_URL;
    private readonly MOODLE_TOKEN = process.env.MOODLE_TOKEN;

    constructor(
        @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
        private readonly courseRepository: CourseRepository,
        private readonly groupRepository: GroupRepository,
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
    private async request<R = Object, D = Object>(fn: string, { params: paramsData, method = 'get' }: RequestOptions<D> = {}) {
        const params = {
            ...paramsData,
            wstoken: this.MOODLE_TOKEN,
            wsfunction: fn,
            moodlewsrestformat: 'json',
        };

        try {
            // If method is POST, send params in the request body as form-encoded to avoid URL length limits (414)
            if (method === 'post') {
                const body = new URLSearchParams();
                for (const [k, v] of Object.entries(params as Record<string, any>)) {
                    if (Array.isArray(v)) {
                        for (const item of v) {
                            body.append(`${k}[]`, (item && typeof item === 'object') ? JSON.stringify(item) : String(item));
                        }
                    } else if (v && typeof v === 'object') {
                        body.append(k, JSON.stringify(v));
                    } else if (v !== undefined && v !== null) {
                        body.append(k, String(v));
                    }
                }

                const response = await axios.request({
                    url: this.MOODLE_URL,
                    method,
                    data: body.toString(),
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });

                if ((response as any).data?.exception) throw (response as any).data;
                return response.data as R;
            }

            const response = await axios.request({ url: this.MOODLE_URL, params, method });

            if (response.data.exception) throw response.data;

            return response.data as R;
        } catch (moodleError) {
            const me: any = moodleError;
            // Log detailed response data when available to help debugging (avoid logging tokens)
            Logger.error({
                message: me?.message,
                status: me?.response?.status,
                responseData: me?.response?.data,
                params,
                url: this.MOODLE_URL,
            }, "MoodleService:request");

            // Include the original error message when throwing so caller/logs get more context
            const message = me?.message || (me?.response && JSON.stringify(me.response)) || 'Error calling Moodle API';
            throw new InternalServerErrorException(message);
        }
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
        const usersWithCustomFields = detailedUsers.filter(user => user.customfields && user.customfields.length > 0);

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
        const completionData = await this.request<any>('core_completion_get_activities_completion_status', {
            params: {
                courseid: courseId,
                userid: user.id
            }
        });

        const activities = completionData.statuses || [];
        const usedActivities = activities.filter((activity: any) => activity.valueused === true);
        const completed = usedActivities.filter((activity: any) => activity.state !== 0).length;
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
        // Validate Moodle configuration early
        if (!this.MOODLE_URL || !this.MOODLE_TOKEN) {
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
                    for (const moodleUser of moodleUsers) {
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
                
                for (const moodleUser of moodleUsers) {
                    await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                    let completionPercentage = null;
                    if (moodleUser.username !== 'guest') {
                        try {
                            const progress = await this.getUserProgressInCourse(moodleUser, parentCourse.id);
                            completionPercentage = progress.completion_percentage != null ? parseInt(progress.completion_percentage as any) : null;
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
                if (!skipUsers) {
                    const enrolledUsers = await this.getEnrolledUsers(moodleCourse.id);
                    console.log(`  [MOODLE IMPORT]   Usuarios matriculados: ${enrolledUsers.length}`);
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
                // Si existe el usuario de Moodle, actualizamos el usuario principal
                userId = existingMoodleUser.id_user;
                
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

                // Si no vienen roles, intentar obtenerlos consultando los usuarios matriculados del curso
                if ((!rolesSource || rolesSource.length === 0)) {
                    try {
                        const group = await this.groupRepository.findById(id_group, { transaction });
                        if (group && group.id_course) {
                            const course = await this.courseRepository.findById(group.id_course, { transaction });
                            if (course && course.moodle_id) {
                                const enrolled = await this.getEnrolledUsers(course.moodle_id);
                                const match = enrolled.find(u => u.id === moodleUser.id);
                                if (match && match.roles && match.roles.length > 0) {
                                    rolesSource = match.roles;
                                }
                            }
                        }
                    } catch (innerErr) {
                        // No bloquear si la llamada a la API adicional falla; seguiremos sin roles
                        Logger.warn({ innerErr, moodleUserId: moodleUser.id, id_group }, 'MoodleService:upsertMoodleUserByGroup - could not fetch enrolled users to resolve roles');
                    }
                }

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
                const existing = userGroupRows[0] as any;
                if (typeof roleIdToAssign !== 'undefined' && existing?.id_role !== roleIdToAssign) {
                    try {
                        await this.userGroupRepository.updateById(userId, id_group, { id_role: roleIdToAssign }, { transaction });
                        Logger.log({ userId, id_group, oldRole: existing?.id_role, newRole: roleIdToAssign }, 'MoodleService:upsertMoodleUserByGroup - role updated');
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
