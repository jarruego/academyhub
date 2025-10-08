import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserComparisonService } from './tools/user-comparison.service';
import { UserComparisonController } from './tools/user-comparison.controller';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { MoodleService } from 'src/api/moodle/moodle.service';
import { GroupModule } from '../group/group.module';
import { CenterRepository } from 'src/database/repository/center/center.repository';
import { CompanyModule } from '../company/company.module';
import { CompanyRepository } from 'src/database/repository/company/company.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';

@Module({
  providers: [
    UserService, 
    UserComparisonService,
    UserRepository, 
    MoodleService, 
    CenterRepository, 
    CompanyRepository, 
    UserGroupRepository, 
    UserCourseRepository
  ],
  controllers: [UserController, UserComparisonController],
  exports: [UserService, UserRepository, UserComparisonService],
  imports: [GroupModule, CompanyModule, MoodleUserModule]
})
export class UserModule {}
