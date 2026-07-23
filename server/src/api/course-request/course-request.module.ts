import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { CourseRequestController } from "./course-request.controller";
import { CourseRequestService } from "./course-request.service";
import { CourseRequestPdfService } from "./course-request-pdf.service";
import { PdfService } from "src/common/pdf/pdf.service";
import {
  CourseRequestRepository,
  CourseRequestStudentRepository,
} from "src/database/repository/course-request/course-request.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [CourseRequestController],
  providers: [CourseRequestService, CourseRequestPdfService, PdfService, CourseRequestRepository, CourseRequestStudentRepository],
  exports: [CourseRequestService],
})
export class CourseRequestModule {}
