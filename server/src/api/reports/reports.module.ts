import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import { ReportsPdfService } from './reports-pdf.service';
import { PdfService } from 'src/common/pdf/pdf.service';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';

@Module({
  providers: [ReportsService, ReportsRepository, ReportsPdfService, PdfService, OrganizationRepository],
  controllers: [ReportsController],
  exports: [ReportsService, ReportsRepository, ReportsPdfService, PdfService],
})
export class ReportsModule {}
