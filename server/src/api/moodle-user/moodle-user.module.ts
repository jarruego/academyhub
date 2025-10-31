import { Module } from '@nestjs/common';
import { MoodleUserController } from './moodle-user.controller';
import { MoodleUserService } from './moodle-user.service';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MoodleUserController],
  providers: [MoodleUserService, MoodleUserRepository, UserCourseRepository],
  exports: [MoodleUserService, MoodleUserRepository, UserCourseRepository],
})
export class MoodleUserModule {}