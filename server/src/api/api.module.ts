import { Module } from "@nestjs/common";
import { CompanyModule } from "src/api/company/company.module";
import { CenterModule } from "src/api/center/center.module";
import { CourseModule } from "src/api/course/course.module";
import { GroupModule } from "src/api/group/group.module";
import { UserModule } from "src/api/user/user.module";
import { MoodleModule } from './moodle/moodle.module';
import { MoodleUserModule } from './moodle-user/moodle-user.module';
import { ImportModule } from './import-sage/import.module';
import { ImportVelneoModule } from './import-velneo/import-velneo.module';

@Module({
  imports: [CompanyModule, CenterModule, CourseModule, GroupModule, UserModule, MoodleModule, MoodleUserModule, ImportModule, ImportVelneoModule],
})
export class ApiModule {}