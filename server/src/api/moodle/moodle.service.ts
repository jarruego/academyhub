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
            const response = await axios.request({ url: this.MOODLE_URL, params, method });

            if (response.data.exception) throw response.data;

            return response.data as R;
        } catch (moodleError) {
            Logger.error({ moodleError, params, url: this.MOODLE_URL }, "Moodle");
            throw new InternalServerErrorException();
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
        const detailedUsers = await this.request<Array<MoodleUser>>('core_user_get_users_by_field', {
            params: {
                field: 'id',
                values: userIds
            }
        });

        
        // Verificar si tienen customfields
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
        const completed = activities.filter((activity: any) => activity.state === 1).length;
        const total = activities.length;
        const completion_percentage = total > 0 ? Math.round((completed / total) * 100) : null;

        return {
            ...user,
            roles: user.roles.map(role => ({
                roleid: role.roleid,
                name: role.name,
                shortname: role.shortname,
                sortorder: role.sortorder
            })),
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
     * OBTIENE LISTA DE CURSOS DE MOODLE CON ESTADO DE IMPORTACIÓN
     * 
     * Devuelve todos los cursos disponibles en Moodle junto con información
     * sobre si ya están importados en nuestra base de datos y cuándo fue la última importación
     */
    async getMoodleCoursesWithImportStatus(): Promise<MoodleCourseWithImportStatus[]> {
        return await this.databaseService.db.transaction(async transaction => {
            console.log('🔍 Obteniendo cursos de Moodle con estado de importación...');
            
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
                
            console.log(`📚 Encontrados ${coursesWithStatus.length} cursos (${coursesWithStatus.filter(c => c.isImported).length} importados)`);
            return coursesWithStatus;
        });
    }

    /**
     * OBTIENE LISTA DE GRUPOS DE UN CURSO DE MOODLE CON ESTADO DE IMPORTACIÓN
     */
    async getMoodleGroupsWithImportStatus(moodleCourseId: number): Promise<MoodleGroupWithImportStatus[]> {
        return await this.databaseService.db.transaction(async transaction => {
            console.log(`🔍 Obteniendo grupos del curso ${moodleCourseId} con estado de importación...`);
            
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
            
            console.log(`🏷️ Encontrados ${groupsWithStatus.length} grupos (${groupsWithStatus.filter(g => g.isImported).length} importados)`);
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
            // Buscar si ya existe un usuario de Moodle con este moodle_id
            const existingMoodleUser = await this.moodleUserService.findByMoodleId(moodleUser.id, { transaction });
            
            let userId: number;
            let moodleUserId: number;

            if (existingMoodleUser) {
                // Si existe el usuario de Moodle, actualizamos el usuario principal
                userId = existingMoodleUser.id_user;
                moodleUserId = existingMoodleUser.id_moodle_user;
                
                await this.userRepository.update(userId, {
                    name: moodleUser.firstname,
                    first_surname: moodleUser.lastname,
                    email: moodleUser.email,
                }, { transaction });
                
                // Actualizar usuario de Moodle
                await this.moodleUserService.update(existingMoodleUser.id_moodle_user, {
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
                const moodleUserResult = await this.moodleUserService.create({
                    id_user: userId,
                    moodle_id: moodleUser.id,
                    moodle_username: moodleUser.username,
                }, { transaction });
                
                moodleUserId = moodleUserResult.insertId;
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

            await this.userCourseRepository.addUserToCourse(userCourseData, { transaction });

            // Actualizar roles de Moodle para el curso
            if (moodleUser.roles) {
                for (const role of moodleUser.roles) {
                    await this.courseRepository.addUserRoleToCourse({
                        id_user: userId,
                        id_course: courseId,
                        id_role: role.roleid,
                        role_shortname: role.shortname
                    }, { transaction });
                }
            }

            return await this.userRepository.findById(userId, { transaction });
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
                console.log(`🎯 Iniciando importación específica del curso Moodle ID: ${moodleCourseId}`);
                
                // Obtener datos del curso desde Moodle
                const moodleCourses = await this.getAllCourses();
                const moodleCourse = moodleCourses.find(course => course.id === moodleCourseId);
                
                if (!moodleCourse) {
                    throw new Error(`Curso con ID ${moodleCourseId} no encontrado en Moodle`);
                }
                
                console.log(`📖 Importando curso: "${moodleCourse.fullname}"`);
                
                // Crear/actualizar el curso
                const course = await this.upsertMoodleCourse(moodleCourse, { transaction });
                
                // Importar usuarios del curso
                console.log('👥 Importando usuarios del curso...');
                const enrolledUsers = await this.getEnrolledUsers(moodleCourse.id);
                let usersImported = 0;
                
                for (const enrolledUser of enrolledUsers) {
                    if (enrolledUser.username === 'guest') {
                        await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                    } else {
                        try {
                            const progress = await this.getUserProgressInCourse(enrolledUser, moodleCourse.id);
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, progress.completion_percentage);
                        } catch (e) {
                            await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                        }
                    }
                    usersImported++;
                }
                
                // Importar grupos del curso
                console.log('🏷️ Importando grupos del curso...');
                const moodleGroups = await this.getCourseGroups(moodleCourse.id);
                
                for (const moodleGroup of moodleGroups) {
                    const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });
                    
                    const moodleUsers = await this.getGroupUsers(moodleGroup.id);
                    for (const moodleUser of moodleUsers) {
                        await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                    }
                }
                
                console.log(`✅ Curso "${moodleCourse.fullname}" importado exitosamente`);
                
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
                console.log(`🎯 Iniciando importación específica del grupo Moodle ID: ${moodleGroupId}`);
                
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
                
                console.log(`🏷️ Importando grupo: "${moodleGroup.name}" del curso "${parentCourse.fullname}"`);
                
                // Asegurarse de que el curso padre esté importado
                const course = await this.upsertMoodleCourse(parentCourse, { transaction });
                
                // Crear/actualizar el grupo
                const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });
                
                // Importar usuarios del grupo
                console.log('👥 Importando usuarios del grupo...');
                const moodleUsers = await this.getGroupUsers(moodleGroup.id);
                let usersImported = 0;
                
                for (const moodleUser of moodleUsers) {
                    await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                    usersImported++;
                }
                
                console.log(`✅ Grupo "${moodleGroup.name}" importado exitosamente`);
                
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
    async importMoodleCourses() {
        return await this.databaseService.db.transaction(async transaction => {
            
            // PASO 1: Obtener TODOS los cursos que existen en Moodle
            console.log('🔍 PASO 1: Obteniendo lista de cursos desde Moodle...');
            const moodleCourses = await this.getAllCourses();
            console.log(`📚 Encontrados ${moodleCourses.length} cursos en Moodle`);
            
            // PASO 2: Procesar cada curso uno por uno
            for (const moodleCourse of moodleCourses) {
                console.log(`\n📖 Procesando curso: "${moodleCourse.fullname}" (ID: ${moodleCourse.id})`);
                
                // Saltarse el curso principal de Moodle (es un curso del sistema, no real)
                if (moodleCourse.id === 1) {
                    console.log('⏭️ Saltando curso principal del sistema Moodle');
                    continue;
                }
                
                // PASO 2A: Crear o actualizar el curso en nuestra base de datos
                console.log('💾 Guardando/actualizando curso en base de datos...');
                const course = await this.upsertMoodleCourse(moodleCourse, { transaction });

                // PASO 2B: Obtener TODOS los usuarios matriculados en este curso
                console.log('👥 Obteniendo usuarios matriculados en el curso...');
                const enrolledUsers = await this.getEnrolledUsers(moodleCourse.id);
                console.log(`👤 Encontrados ${enrolledUsers.length} usuarios matriculados`);
                
                // PASO 2C: Procesar cada usuario matriculado
                for (const enrolledUser of enrolledUsers) {
                    console.log(`  👤 Procesando usuario: ${enrolledUser.username}`);
                    
                    // Los usuarios "guest" son especiales (invitados), no tienen progreso
                    if (enrolledUser.username === 'guest') {
                        console.log('  👻 Usuario invitado - guardando sin progreso');
                        await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                        continue;
                    }
                    
                    try {
                        // PASO 2C1: Intentar obtener el progreso del usuario en el curso
                        console.log(`  📊 Obteniendo progreso del usuario en el curso...`);
                        const progress = await this.getUserProgressInCourse(enrolledUser, moodleCourse.id);
                        console.log(`  ✅ Progreso obtenido: ${progress.completion_percentage}%`);
                        
                        // PASO 2C2: Guardar usuario + progreso en nuestra BD
                        await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, progress.completion_percentage);
                        
                    } catch (e) {
                        // Si no se puede obtener progreso (ej: permisos), guardar sin progreso
                        console.log(`  ⚠️ No se pudo obtener progreso - guardando sin progreso`);
                        await this.upsertMoodleUserAndEnrollToCourse(enrolledUser, course.id_course, { transaction }, null);
                    }
                }

                // PASO 2D: Obtener TODOS los grupos asociados a este curso
                console.log('👥 Obteniendo grupos del curso...');
                const moodleGroups = await this.getCourseGroups(moodleCourse.id);
                console.log(`🏷️ Encontrados ${moodleGroups.length} grupos`);
                
                // PASO 2E: Procesar cada grupo del curso
                for (const moodleGroup of moodleGroups) {
                    console.log(`  🏷️ Procesando grupo: ${moodleGroup.name}`);
                    
                    // PASO 2E1: Crear/actualizar el grupo en nuestra BD
                    const newGroup = await this.groupRepository.upsertMoodleGroup(moodleGroup, course.id_course, { transaction });

                    // PASO 2E2: Obtener usuarios que pertenecen a este grupo
                    console.log(`    👥 Obteniendo usuarios del grupo...`);
                    const moodleUsers = await this.getGroupUsers(moodleGroup.id);
                    console.log(`    👤 Encontrados ${moodleUsers.length} usuarios en el grupo`);
                    
                    // PASO 2E3: Procesar cada usuario del grupo
                    for (const moodleUser of moodleUsers) {
                        console.log(`      👤 Asignando usuario ${moodleUser.username} al grupo`);
                        await this.upsertMoodleUserByGroup(moodleUser, newGroup.id_group, { transaction });
                    }
                }
                
                console.log(`✅ Curso "${moodleCourse.fullname}" procesado completamente`);
            }

            console.log('\n🎉 ¡IMPORTACIÓN COMPLETADA! Todos los datos de Moodle han sido sincronizados');
            return { message: 'Cursos, grupos y usuarios importados y actualizados correctamente' };
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

            // Verificar si el usuario ya está en el grupo
            const userGroupRows = await this.userGroupRepository.findUserInGroup(userId, id_group, { transaction });

            if (userGroupRows.length <= 0) {
                await this.groupService.addUserToGroup({id_group, id_user: userId}, { transaction });
            }
        };

        if (options?.transaction) return await run(options.transaction);
        return await this.databaseService.db.transaction(async transaction => await run(transaction));
    }
}
