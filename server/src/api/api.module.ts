import { Module } from "@nestjs/common";
import { CompanyModule } from "src/api/company/company.module";
import { CenterModule } from "src/api/center/center.module";
import { CourseModule } from "src/api/course/course.module";
import { GroupModule } from "src/api/group/group.module";
import { UserModule } from "src/api/user/user.module";
import { MoodleModule } from './moodle/moodle.module';
import { ForumModule } from './forum/forum.module';
import { MoodleUserModule } from './moodle-user/moodle-user.module';
import { ImportModule } from './import-sage/import.module';
import { ImportInaemModule } from './import-inaem/import-inaem.module';
import { ReportsModule } from './reports/reports.module';
import { MailModule } from './mail/mail.module';
import { SmsModule } from './sms/sms.module';
import { OrganizationModule } from './organization/organization.module';
import { FilesModule } from './files/files.module';
import { AuditModule } from './audit/audit.module';
import { UserMergeModule } from './user-merge/user-merge.module';
import { UserSanitizationModule } from './user-sanitization/user-sanitization.module';
import { BackupsModule } from './backups/backups.module';
import { MoodleAuditModule } from './moodle-audit/moodle-audit.module';
import { CourseRequestModule } from './course-request/course-request.module';
import { CourseCatalogModule } from './course-catalog/course-catalog.module';
import { CourseCandidateModule } from './course-candidate/course-candidate.module';
import { CourseInterestModule } from './course-interest/course-interest.module';

@Module({
  imports: [CompanyModule, CenterModule, CourseCatalogModule, CourseCandidateModule, CourseInterestModule, CourseModule, GroupModule, UserModule, MoodleModule, ForumModule, MoodleUserModule, ImportModule, ImportInaemModule, ReportsModule, OrganizationModule, FilesModule, MailModule, SmsModule, AuditModule, UserMergeModule, UserSanitizationModule, BackupsModule, MoodleAuditModule, CourseRequestModule],
})
export class ApiModule {}
