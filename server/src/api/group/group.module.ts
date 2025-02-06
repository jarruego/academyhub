import { Module } from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { CourseRepository } from 'src/database/repository/course/course.repository';

@Module({
  providers: [GroupService, GroupRepository, CourseRepository],
  controllers: [GroupController],
  exports: [GroupService, GroupRepository],
})
export class GroupModule {}
