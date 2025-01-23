import { Injectable, HttpException, HttpStatus, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';
import { MoodleCourse } from 'src/types/moodle/course';
import { MoodleGroup } from 'src/types/moodle/group';
import { MoodleUser } from 'src/types/moodle/user';

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
            const response = await axios.request({url: this.MOODLE_URL, params, method });

            if (response.data.exception) throw response.data;
            
            return response.data as R;
        } catch (moodleError) {
            Logger.error({moodleError, params, url: this.MOODLE_URL}, "Moodle");
            throw new InternalServerErrorException();
        }
    }


    async getAllUsers() {
        const data = await this.request<{users: Array<MoodleUser>}>('core_user_get_users', {params: {criteria: [
            {
                key: 'deleted',
                value: '0'
            }
        ]}});

        return data.users;
    }

    async getUserById(userId: number) {
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

    async getAllCourses() {
        const data = await this.request<Array<MoodleCourse>>('core_course_get_courses');
        return data;
    }

    async getCourseGroups(courseId: number) {
        const data = await this.request<Array<MoodleGroup>>('core_group_get_course_groups', {
            params: {
                courseid: courseId
            }
        });

        return data;
    }

    async getGroupUsers(groupId: number) {
        const data = await this.request<{users: Array<MoodleUser>}>('core_group_get_group_members', {
            params: {
                groupids: [groupId]
            }
        });

        return data.users;
    }

    async getEnrolledUsers(courseId: number) {
        const data = await this.request<Array<MoodleUser>>('core_enrol_get_enrolled_users', {
            params: {
                courseid: courseId
            }
        });

        return data;
    }

    async getCourseUserProfiles(courseId: number, userId: number) {
        const data = await this.request<Array<MoodleUser>>('core_user_get_course_user_profiles', {
            params: {
                userlist: [{ courseid: courseId, userid: userId }]
            }
        });

        return data;
    }
}
