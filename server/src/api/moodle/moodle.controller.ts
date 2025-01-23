import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { MoodleService } from './moodle.service';

@Controller('moodle')
export class MoodleController {
    constructor(private readonly moodleService: MoodleService) {}

    @Get('users')
    async getAllUsers() {
        return this.moodleService.getAllUsers();
    }

    @Get('users/:id')
    async getUserById(@Param('id', ParseIntPipe) id: number) {
        return this.moodleService.getUserById(id);
    }

      @Get('courses')
    async getAllCourses() {
        return this.moodleService.getAllCourses();
    }

    @Get('courses/:id/groups')
    async getCourseGroups(@Param('id', ParseIntPipe) id: number) {
        return this.moodleService.getCourseGroups(id);
    }

    @Get('groups/:id/users')
    async getGroupUsers(@Param('id', ParseIntPipe) id: number) {
        return this.moodleService.getGroupUsers(id);
    }

    @Get('courses/:id/enrolled-users')
    /**
     * Retrieves the list of users enrolled in a specific course.
     * 
     * @param id - The ID of the course for which to retrieve enrolled users.
     * @returns A promise that resolves to the list of enrolled users.
     */
    async getEnrolledUsers(@Param('id', ParseIntPipe) id: number) {
        return this.moodleService.getEnrolledUsers(id);
    }

    @Get('courses/:courseId/users/:userId/profiles')
    async getCourseUserProfiles(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Param('userId', ParseIntPipe) userId: number
    ) {
        return this.moodleService.getCourseUserProfiles(courseId, userId);
    }
}
