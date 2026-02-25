import { Module } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsController } from './smtp-settings.controller';
import { DatabaseModule } from '../../database/database.module';
import { MailService } from './mail.service';
import { SmtpTestController } from './smtp-test.controller';
import { MailTemplatesService } from './mail-templates.service';
import { MailTemplatesController } from './mail-templates.controller';

@Module({
  imports: [DatabaseModule],
  providers: [SmtpSettingsService, MailService, MailTemplatesService],
  controllers: [SmtpSettingsController, SmtpTestController, MailTemplatesController],
  exports: [SmtpSettingsService, MailTemplatesService],
})
export class SmtpModule {}
