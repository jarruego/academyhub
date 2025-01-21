import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MoodleService {
    private readonly MOODLE_URL = process.env.MOODLE_URL;
    private readonly MOODLE_TOKEN = process.env.MOODLE_TOKEN;


    async testToken() {
        const params = {
            wstoken: this.MOODLE_TOKEN,
            wsfunction: 'core_webservice_get_site_info',
            moodlewsrestformat: 'json'
        };

        try {
            const response = await axios.get(this.MOODLE_URL, { params });
            return response.data;
        } catch (error) {
            throw new HttpException('Error al acceder al servicio de Moodle', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getUserInfo(userId: string) {
        const params = {
            wstoken: this.MOODLE_TOKEN,
            wsfunction: 'core_user_get_users_by_field',
            moodlewsrestformat: 'json',
            field: 'id',
            values: [userId]
        };
        const response = await axios.get(this.MOODLE_URL, { params });
        if (response.data && response.data.length > 0) {
            const user = response.data[0];
            // return {
            //     username: user.username,
            //     firstname: user.firstname,
            //     lastname: user.lastname,
            //     city: user.city,
            //     country: user.country,
            //     email: user.email,
            //     fullname: user.fullname 
            // };
            return user;
        } else {
            throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
        }
    }
}
