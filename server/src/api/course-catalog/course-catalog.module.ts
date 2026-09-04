import { Module } from "@nestjs/common";
import { CatalogCourseRepository } from "src/database/repository/course/catalog-course.repository";
import { CourseCatalogController } from "./course-catalog.controller";
import { CourseCatalogService } from "./course-catalog.service";

@Module({
  controllers: [CourseCatalogController],
  providers: [CourseCatalogService, CatalogCourseRepository],
  exports: [CourseCatalogService, CatalogCourseRepository],
})
export class CourseCatalogModule {}
