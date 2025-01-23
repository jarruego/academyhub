
import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { MoodleService } from '../moodle/moodle.service';

@Module({
  providers: [CourseService, CourseRepository, MoodleService],
  controllers: [CourseController],
  exports: [CourseService, CourseRepository], 
})
export class CourseModule {}