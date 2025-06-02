import { Module } from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupBonificableService } from './group-bonification.service';

@Module({
  providers: [GroupService, GroupRepository, CourseRepository, GroupBonificableService],
  controllers: [GroupController],
  exports: [GroupService, GroupRepository, GroupBonificableService],
})
export class GroupModule {}
