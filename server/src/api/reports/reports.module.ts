import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsMailService } from './reports-mail.service';
import { PdfService } from 'src/common/pdf/pdf.service';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { ReportRenderer } from './report-renderer.service';
import { CourseModule } from '../course/course.module';
import { MailModule } from '../mail/mail.module';
import { CourseRequestModule } from '../course-request/course-request.module';

@Module({
  imports: [CourseModule, MailModule, CourseRequestModule],
  providers: [ReportsService, ReportsRepository, ReportsPdfService, ReportsMailService, PdfService, OrganizationRepository, ReportRenderer],
  controllers: [ReportsController],
  exports: [ReportsService, ReportsRepository, ReportsPdfService, PdfService, ReportRenderer],
})
export class ReportsModule {}
