import { Module } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsController } from './smtp-settings.controller';
import { DatabaseModule } from '../../database/database.module';
import { MailService } from './mail.service';
import { SmtpTestController } from './smtp-test.controller';

@Module({
  imports: [DatabaseModule],
  providers: [SmtpSettingsService, MailService],
  controllers: [SmtpSettingsController, SmtpTestController],
  exports: [SmtpSettingsService],
})
export class SmtpModule {}
