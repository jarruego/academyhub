import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserComparisonService } from './tools/user-comparison.service';
import { UserComparisonController } from './tools/user-comparison.controller';
import { UserRepository } from 'src/database/repository/user/user.repository';
import { GroupModule } from '../group/group.module';
import { CenterRepository } from 'src/database/repository/center/center.repository';
import { CompanyModule } from '../company/company.module';
import { CompanyRepository } from 'src/database/repository/company/company.repository';
import { UserGroupRepository } from 'src/database/repository/group/user-group.repository';
import { UserCourseRepository } from 'src/database/repository/course/user-course.repository';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';
import { MoodleModule } from '../moodle/moodle.module';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { UserCoursesCertificateService } from './user-courses-certificate.service';
import { PdfService } from 'src/common/pdf/pdf.service';
import { ReportRenderer } from '../reports/report-renderer.service';

@Module({
  providers: [
    UserService, 
    UserComparisonService,
    UserCoursesCertificateService,
    PdfService,
    ReportRenderer,
    UserRepository, 
    CenterRepository, 
    CompanyRepository, 
    OrganizationRepository,
    UserGroupRepository, 
    UserCourseRepository
  ],
  controllers: [UserController, UserComparisonController],
  exports: [UserService, UserRepository, UserComparisonService],
  imports: [GroupModule, CompanyModule, MoodleUserModule, MoodleModule]
})
export class UserModule {}
