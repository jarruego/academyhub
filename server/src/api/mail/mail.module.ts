import { Module } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsController } from './smtp-settings.controller';
import { DatabaseModule } from '../../database/database.module';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailTemplatesService } from './mail-templates.service';
import { MailTemplatesController } from './mail-templates.controller';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';
import { MoodleMessageService } from './moodle-message.service';
import { AuthUserRepository } from '../../database/repository/auth/auth_user.repository';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [DatabaseModule, MoodleUserModule],
  providers: [SmtpSettingsService, MailService, MailTemplatesService, MoodleMessageService, AuthUserRepository, SupabaseStorageService],
  controllers: [SmtpSettingsController, MailController, MailTemplatesController],
  exports: [SmtpSettingsService, MailTemplatesService],
})
export class MailModule {}
