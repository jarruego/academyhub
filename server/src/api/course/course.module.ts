
import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { MoodleService } from '../moodle/moodle.service';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { UserModule } from '../user/user.module';

@Module({
  providers: [CourseService, CourseRepository, GroupRepository, MoodleService],
  controllers: [CourseController],
  exports: [CourseService, CourseRepository],
  imports: [UserModule]
})
export class CourseModule {}