
import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { CourseRepository } from 'src/database/repository/course/course.repository';

@Module({
  providers: [CourseService, CourseRepository],
  controllers: [CourseController],
  exports: [CourseService, CourseRepository], 
})
export class CourseModule {}