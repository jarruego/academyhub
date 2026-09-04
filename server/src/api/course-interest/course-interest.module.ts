import { Module } from "@nestjs/common";
import { CourseCandidateRepository } from "src/database/repository/course-candidate/course-candidate.repository";
import { CourseRepository } from "src/database/repository/course/course.repository";
import { CourseInterestRepository } from "src/database/repository/course-interest/course-interest.repository";
import { UserRepository } from "src/database/repository/user/user.repository";
import { CourseInterestController } from "./course-interest.controller";
import { CourseInterestService } from "./course-interest.service";

@Module({
  controllers: [CourseInterestController],
  providers: [CourseInterestService, CourseInterestRepository, CourseCandidateRepository, CourseRepository, UserRepository],
  exports: [CourseInterestService, CourseInterestRepository],
})
export class CourseInterestModule {}
