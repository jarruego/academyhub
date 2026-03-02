import { Module } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsController } from './smtp-settings.controller';
import { DatabaseModule } from '../../database/database.module';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailTemplatesService } from './mail-templates.service';
import { MailTemplatesController } from './mail-templates.controller';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';

@Module({
  imports: [DatabaseModule, MoodleUserModule],
  providers: [SmtpSettingsService, MailService, MailTemplatesService],
  controllers: [SmtpSettingsController, MailController, MailTemplatesController],
  exports: [SmtpSettingsService, MailTemplatesService],
})
export class MailModule {}
