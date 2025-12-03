import { Controller, Get, Query, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { MoodleCourseListResponse, MoodleGroupListResponse, ImportResult } from 'src/dto/moodle/import.dto';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';

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

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Get('courses/with-import-status')
    async getMoodleCoursesWithImportStatus(): Promise<MoodleCourseListResponse> {
        const courses = await this.moodleService.getMoodleCoursesWithImportStatus();
        return { courses };
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Get('courses/:moodleCourseId/groups/with-import-status')
    async getMoodleGroupsWithImportStatus(@Param('moodleCourseId', ParseIntPipe) moodleCourseId: number): Promise<MoodleGroupListResponse> {
        const groups = await this.moodleService.getMoodleGroupsWithImportStatus(moodleCourseId);
        return { groups };
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('courses/:moodleCourseId/import')
    async importSpecificMoodleCourse(@Param('moodleCourseId', ParseIntPipe) moodleCourseId: number): Promise<ImportResult> {
        return await this.moodleService.importSpecificMoodleCourse(moodleCourseId);
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('groups/:moodleGroupId/import')
    async importSpecificMoodleGroup(@Param('moodleGroupId', ParseIntPipe) moodleGroupId: number): Promise<ImportResult> {
        return await this.moodleService.importSpecificMoodleGroup(moodleGroupId);
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('groups/:moodleGroupId/sync-members')
    async syncMoodleGroupMembers(@Param('moodleGroupId', ParseIntPipe) moodleGroupId: number): Promise<ImportResult> {
        const result = await this.moodleService.syncMoodleGroupMembers(moodleGroupId);

        // If there are per-user details with errors, append a short summary to the message
        if (result.details && result.details.length > 0) {
            const max = 10;
            const items = result.details.slice(0, max).map(d => {
                const idPart = d.userId ? `${d.userId}` : 'id?';
                const userPart = d.username ? `${d.username} (${idPart})` : idPart;
                return `${userPart}: ${d.error}`;
            });
            const more = result.details.length > max ? `\n... y ${result.details.length - max} más` : '';
            result.message = `${result.message}\nErrores:\n${items.join('\n')}${more}`;
        }

        return result;
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('groups/:groupId/push')
    /**
     * Create or update a local group in Moodle. If the local group doesn't have a `moodle_id`
     * it will be created in Moodle and the returned moodle id will be persisted locally.
     */
    async pushGroupToMoodle(@Param('groupId', ParseIntPipe) groupId: number) {
        return await this.moodleService.pushLocalGroupToMoodle(groupId);
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('groups/:groupId/delete')
    /**
     * Delete the corresponding group in Moodle and clear local moodle_id.
     */
    async deleteGroupInMoodle(@Param('groupId', ParseIntPipe) groupId: number) {
        return await this.moodleService.deleteLocalGroupFromMoodle(groupId);
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('import-all')
    async importMoodleCourses(@Query('skipUsers') skipUsers?: string) {
        // Accepts skipUsers as query param (e.g., /import-all?skipUsers=true)
        const skip = skipUsers === 'true';
        return await this.moodleService.importMoodleCourses(skip);
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Post('users/sync-usernames')
    async syncUsernamesFromMoodle() {
        return await this.moodleService.syncUsernamesFromMoodle();
    }

    @UseGuards(RoleGuard([Role.ADMIN]))
    @Get('check')
    async checkConnection() {
        try {
            const info = await this.moodleService.getSiteInfo();
            return { success: true, info };
        } catch (err: unknown) {
            // Normalize error message for client
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, message };
        }
    }
}
