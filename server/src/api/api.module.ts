import { Module } from "@nestjs/common";
import { CompanyModule } from "src/api/company/company.module";
import { CenterModule } from "src/api/center/center.module";
import { CourseModule } from "src/api/course/course.module";

@Module({
  imports: [CompanyModule, CenterModule, CourseModule],
})
export class ApiModule {}