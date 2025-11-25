import { Controller, Get, UseGuards, Query, Post, Body, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import { ReportExportDTO } from 'src/dto/reports/report-export.dto';
import type { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Get()
  async findAll(@Query() query: ReportFilterDTO) {
    return this.reportsService.findAll(query);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Post('export')
  async exportPdf(@Body() body: ReportExportDTO, @Res() res: Response) {
    await this.reportsPdfService.exportPdfFromPayload(body, res);
  }
}
