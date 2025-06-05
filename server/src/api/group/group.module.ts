import { Module } from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { GroupRepository } from 'src/database/repository/group/group.repository';
import { CourseRepository } from 'src/database/repository/course/course.repository';
import { GroupBonificableService } from './group-bonification.service';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { UserGroupRepository } from 'src/database/repository/course/user-group.repository';
import { UserCenterRepository } from 'src/database/repository/center/user-center.repository';

@Module({
  providers: [GroupService, GroupRepository, CourseRepository, GroupBonificableService, UserCourseRepository, UserGroupRepository, UserCenterRepository],
  controllers: [GroupController],
  exports: [GroupService, GroupRepository, GroupBonificableService],
})
export class GroupModule {}
