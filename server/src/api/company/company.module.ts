import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { CompanyRepository } from 'src/database/repository/company/company.repository';
import { CenterRepository } from 'src/database/repository/center/center.repository'; // Importar CenterRepository
import { UserCenterRepository } from 'src/database/repository/center/user-center.repository';

@Module({
  providers: [CompanyService, CompanyRepository, CenterRepository, UserCenterRepository],
  controllers: [CompanyController],
  exports: [CompanyService, CompanyRepository],
})
export class CompanyModule {}