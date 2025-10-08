import { Injectable, HttpException, HttpStatus, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';
import { MoodleCourse } from 'src/types/moodle/course';
import { MoodleGroup } from 'src/types/moodle/group';
import { MoodleUser, ExtendedMoodleUser } from 'src/types/moodle/user';

type RequestOptions<D> = {
    params?: D;
    method?: 'get' | 'post';
}



@Injectable()
export class MoodleService {
    private readonly MOODLE_URL = process.env.MOODLE_URL;
    private readonly MOODLE_TOKEN = process.env.MOODLE_TOKEN;

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
}
