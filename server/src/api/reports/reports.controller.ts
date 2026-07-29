import { Controller, Get, UseGuards, Query, Post, Body, Res, Req, ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { JwtPayload } from 'src/auth/auth.service';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import { ReportExportDTO } from 'src/dto/reports/report-export.dto';
import type { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  @Get()
  async findAll(@Query() query: ReportFilterDTO) {
    return this.reportsService.findAll(query);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  @Get('roles')
  async getRoles() {
    return this.reportsService.getRoles();
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  @Get('facets')
  async getFacets(@Query() query: ReportFilterDTO) {
    return this.reportsService.getFacets(query);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  @Post('export')
  async exportPdf(@Body() body: ReportExportDTO, @Req() req: { user: JwtPayload }, @Res() res: Response) {
    if (body.include_passwords && req.user?.role === Role.VIEWER) {
      throw new ForbiddenException('El rol VIEWER no puede exportar informes con contraseñas.');
    }
    await this.reportsPdfService.exportPdfFromPayload(body, res);
  }
}
