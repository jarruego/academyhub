
import { Module } from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { MoodleController } from './moodle.controller';
import { DatabaseModule } from 'src/database/database.module';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { MoodleUserService } from '../moodle-user/moodle-user.service';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { GroupModule } from '../group/group.module';

@Module({
  imports: [DatabaseModule, GroupModule],
  providers: [
    MoodleService,
    CourseRepository,
    GroupRepository,
    UserCourseRepository,
    UserRepository,
    UserGroupRepository,
    MoodleUserService,
    MoodleUserRepository,
  ],
  controllers: [MoodleController],
  exports: [MoodleService],
})
export class MoodleModule {}