
import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { UserModule } from '../user/user.module';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';
import { MoodleModule } from '../moodle/moodle.module';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserPreinscriptionRepository } from 'src/database/repository/preinscription/user-preinscription.repository';

@Module({
  providers: [CourseService, CourseRepository, GroupRepository, UserCourseRepository, UserPreinscriptionRepository],
  controllers: [CourseController],
  exports: [CourseService, CourseRepository],
  imports: [UserModule, MoodleUserModule, MoodleModule]
})
export class CourseModule {}