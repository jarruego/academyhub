import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { DatabaseModule } from 'src/database/database.module';
import { MoodleModule } from '../moodle/moodle.module';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { AuthUserRepository } from 'src/database/repository/auth/auth_user.repository';

@Module({
  imports: [DatabaseModule, MoodleModule],
  providers: [
    ForumService,
    CourseRepository,
    GroupRepository,
    UserGroupRepository,
    MoodleUserRepository,
    AuthUserRepository,
  ],
  controllers: [ForumController],
  exports: [ForumService],
})
export class ForumModule {}
