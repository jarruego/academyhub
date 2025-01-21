import { Controller, Get, Query } from '@nestjs/common';
import { MoodleService } from './moodle.service';

@Controller('moodle')
export class MoodleController {
    constructor(private readonly moodleService: MoodleService) {}

    @Get('test-token')
    async testToken() {
        return this.moodleService.testToken();
    }

    @Get('username')
    async getUsername(@Query('userId') userId: string) {
        return this.moodleService.getUserInfo(userId);
    }
}
