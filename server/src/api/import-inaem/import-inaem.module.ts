import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { ImportModule } from "../import-sage/import.module";
import { GroupModule } from "../group/group.module";
import { InaemImportController } from "./inaem-import.controller";
import { InaemImportService } from "./inaem-import.service";
import { UserPreinscriptionRepository } from "src/database/repository/preinscription/user-preinscription.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { CatalogCourseRepository } from "src/database/repository/course/catalog-course.repository";
import { CourseCandidateRepository } from "src/database/repository/course-candidate/course-candidate.repository";
import { CourseInterestRepository } from "src/database/repository/course-interest/course-interest.repository";

@Module({
  // ImportModule exporta JobService (gestión genérica de import_jobs); GroupModule
  // exporta GroupService (matriculación canónica: user_course + user_group + rol).
  imports: [DatabaseModule, ImportModule, GroupModule],
  controllers: [InaemImportController],
  providers: [InaemImportService, UserPreinscriptionRepository, UserGroupRepository, CatalogCourseRepository, CourseCandidateRepository, CourseInterestRepository],
  exports: [InaemImportService],
})
export class ImportInaemModule {}
