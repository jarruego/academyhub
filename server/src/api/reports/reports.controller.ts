import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RoleGuard } from 'src/guards/role.guard';
import { Role } from 'src/guards/role.enum';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  @Get()
  async findAll(@Query() query: ReportFilterDTO) {
    return this.reportsService.findAll(query);
  }
}
