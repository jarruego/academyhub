import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { CourseCategoryController } from "./course-category.controller";
import { CourseCategoryService } from "./course-category.service";
import { CourseCategoryRepository } from "src/database/repository/course/course-category.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [CourseCategoryController],
  providers: [CourseCategoryService, CourseCategoryRepository],
  exports: [CourseCategoryService, CourseCategoryRepository],
})
export class CourseCategoryModule {}
