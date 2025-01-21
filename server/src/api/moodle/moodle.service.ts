import { Injectable, HttpException, HttpStatus, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';

type RequestOptions<D> = {
    params?: D;
    method?: 'get' | 'post';
}

type MoodleUser = {
    id: number,
    username: string,
    firstname: string,
    lastname: string,
    fullname: string,
    email: string,
    department: string,
    firstaccess: number,
    lastaccess: number,
    auth: string,
    suspended: boolean,
    confirmed: boolean,
    lang: string,
    theme: string,
    timezone: string,
    mailformat: number,
    description: string,
    descriptionformat: number,
    city: string,
    country: string,
    profileimageurlsmall: string,
    profileimageurl: string
};

type MoodleCourse = {
    id: number,
    fullname: string,
    shortname: string,
    categoryid: number,
    summary: string,
    summaryformat: number,
    format: string,
    showgrades: boolean,
    newsitems: number,
    startdate: number,
    enddate: number,
    maxbytes: number,
    showreports: boolean,
    visible: boolean,
    groupmode: number,
    groupmodeforce: boolean,
    defaultgroupingid: number,
    enablecompletion: boolean,
    completionnotify: boolean,
    lang: string,
    theme: string,
    marker: number,
    legacyfiles: number,
    calendar_type: string,
    timecreated: number,
    timemodified: number,
    requested: boolean,
    cacherev: number
};

type MoodleGroup = {
    id: number,
    courseid: number,
    name: string,
    description: string,
    descriptionformat: number,
    enrolmentkey: string,
    idnumber: string,
    timecreated: number,
    timemodified: number
};

@Injectable()
export class MoodleService {
    private readonly MOODLE_URL = process.env.MOODLE_URL;
    private readonly MOODLE_TOKEN = process.env.MOODLE_TOKEN; 

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
}
