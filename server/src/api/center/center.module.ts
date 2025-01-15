import { Module } from '@nestjs/common';
import { CenterService } from './center.service';
import { CenterController } from './center.controller';
import { CenterRepository } from 'src/database/repository/center/center.repository';
import { CompanyModule } from 'src/api/company/company.module'; 

@Module({
  imports: [CompanyModule], 
  providers: [CenterService, CenterRepository],
  controllers: [CenterController],
  exports: [CenterService],
})
export class CenterModule {}