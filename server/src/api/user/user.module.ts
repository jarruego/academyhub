import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { MoodleService } from 'src/api/moodle/moodle.service';
import { GroupModule } from '../group/group.module';
import { CenterModule } from '../center/center.module';
import { CenterRepository } from 'src/database/repository/center/center.repository';
import { CompanyModule } from '../company/company.module';
import { CompanyRepository } from 'src/database/repository/company/company.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';

@Module({
  providers: [UserService, UserRepository, MoodleService, CenterRepository, CompanyRepository, UserGroupRepository],
  controllers: [UserController],
  exports: [UserService, UserRepository],
  imports: [GroupModule, CompanyModule, MoodleUserModule]
})
export class UserModule {}
