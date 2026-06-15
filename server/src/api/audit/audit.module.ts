import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AuditController } from './audit.controller';
import { EmailLogController } from './email-log.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController, EmailLogController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
