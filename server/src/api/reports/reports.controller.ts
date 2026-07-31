import { Controller, Get, UseGuards, Query, Post, Body, Res, Req, ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsMailService } from './reports-mail.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { JwtPayload } from 'src/auth/auth.service';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import { ReportExportDTO } from 'src/dto/reports/report-export.dto';
import { ReportSendDTO } from 'src/dto/reports/report-send.dto';
import type { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService,
    private readonly reportsMailService: ReportsMailService,
  ) {}

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @Get()
  async findAll(@Query() query: ReportFilterDTO) {
    return this.reportsService.findAll(query);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @Get('roles')
  async getRoles() {
    return this.reportsService.getRoles();
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @Get('facets')
  async getFacets(@Query() query: ReportFilterDTO) {
    return this.reportsService.getFacets(query);
  }

  // Solo ADMIN/MANAGER/TUTOR: el envío de informes a centros (send/groups/send/send-test)
  // no es accesible para VIEWER, a diferencia del resto de /reports.
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.TUTOR]))
  @Post('send/groups')
  async resolveSendGroups(@Body() body: ReportExportDTO) {
    return this.reportsMailService.resolveSendGroups({
      filter: body.filter,
      selected_keys: body.selected_keys,
      select_all_matching: body.select_all_matching,
      deselected_keys: body.deselected_keys,
    });
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR]))
  @Post('export')
  async exportPdf(@Body() body: ReportExportDTO, @Req() req: { user: JwtPayload }, @Res() res: Response) {
    if (body.include_passwords && (req.user?.role === Role.VIEWER || req.user?.role === Role.TUTOR)) {
      throw new ForbiddenException('Este rol no puede exportar informes con contraseñas.');
    }
    await this.reportsPdfService.exportPdfFromPayload(body, res);
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.TUTOR]))
  @Post('send')
  async sendReport(@Body() body: ReportSendDTO, @Req() req: { user: JwtPayload }) {
    if (body.attach?.includes('dedication_passwords') && (req.user?.role === Role.VIEWER || req.user?.role === Role.TUTOR)) {
      throw new ForbiddenException('Este rol no puede enviar informes con contraseñas.');
    }
    const results = await this.reportsMailService.sendReportMail(body, req.user && {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    });
    return { results };
  }

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.TUTOR]))
  @Post('send/test')
  async sendReportTest(@Body() body: ReportSendDTO, @Req() req: { user: JwtPayload }) {
    if (body.attach?.includes('dedication_passwords') && (req.user?.role === Role.VIEWER || req.user?.role === Role.TUTOR)) {
      throw new ForbiddenException('Este rol no puede enviar informes con contraseñas.');
    }
    return this.reportsMailService.sendTestReportMail(body, req.user && {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    });
  }
}
