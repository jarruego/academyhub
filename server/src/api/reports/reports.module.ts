import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';

@Module({
  providers: [ReportsService, ReportsRepository],
  controllers: [ReportsController],
  exports: [ReportsService, ReportsRepository],
})
export class ReportsModule {}
