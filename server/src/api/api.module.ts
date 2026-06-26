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
import { OrganizationModule } from './organization/organization.module';
import { FilesModule } from './files/files.module';
import { AuditModule } from './audit/audit.module';
import { UserMergeModule } from './user-merge/user-merge.module';
import { UserSanitizationModule } from './user-sanitization/user-sanitization.module';

@Module({
  imports: [CompanyModule, CenterModule, CourseModule, GroupModule, UserModule, MoodleModule, ForumModule, MoodleUserModule, ImportModule, ImportInaemModule, ReportsModule, OrganizationModule, FilesModule, MailModule, AuditModule, UserMergeModule, UserSanitizationModule],
})
export class ApiModule {}