import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { DatabaseModule } from 'src/database/database.module';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { StorageModule } from 'src/common/storage/storage.module';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
