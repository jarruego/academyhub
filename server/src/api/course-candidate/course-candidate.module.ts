import { Module } from "@nestjs/common";
import { CourseCandidateRepository } from "src/database/repository/course-candidate/course-candidate.repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CourseInterestRepository } from "src/database/repository/course-interest/course-interest.repository";
import { UserPreinscriptionRepository } from "src/database/repository/preinscription/user-preinscription.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CourseCandidateController } from "./course-candidate.controller";
import { CourseCandidateService } from "./course-candidate.service";

@Module({
  controllers: [CourseCandidateController],
  providers: [CourseCandidateService, CourseCandidateRepository, UserPreinscriptionRepository, CourseInterestRepository, CourseRepository, UserRepository],
  exports: [CourseCandidateService, CourseCandidateRepository],
})
export class CourseCandidateModule {}
