import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CompanyRepository } from 'src/database/repository/company/company.repository';

@Module({
  providers: [CompanyService, CompanyRepository],
  controllers: [CompanyController],
  exports: [CompanyService, CompanyRepository], 
})
export class CompanyModule {}