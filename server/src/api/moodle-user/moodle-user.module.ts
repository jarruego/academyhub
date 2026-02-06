import { Module } from '@nestjs/common';
import { MoodleUserController } from './moodle-user.controller';
import { MoodleUserService } from './moodle-user.service';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MoodleUserController],
  providers: [MoodleUserService, MoodleUserRepository, UserCourseRepository, UserGroupRepository],
  exports: [MoodleUserService, MoodleUserRepository, UserCourseRepository, UserGroupRepository],
})
export class MoodleUserModule {}