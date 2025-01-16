import { Module } from "@nestjs/common";
import { CompanyModule } from "src/api/company/company.module";
import { CenterModule } from "src/api/center/center.module";
import { CourseModule } from "src/api/course/course.module";
import { GroupModule } from "src/api/group/group.module";

@Module({
  imports: [CompanyModule, CenterModule, CourseModule, GroupModule],
})
export class ApiModule {}