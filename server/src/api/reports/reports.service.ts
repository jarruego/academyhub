import { Injectable } from '@nestjs/common';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async findAll(filter?: ReportFilterDTO) {
    return this.reportsRepository.getReportRows(filter);
  }
}
