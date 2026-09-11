import { Module } from '@nestjs/common';
import { SmsSettingsService } from './sms-settings.service';
import { SmsSettingsController } from './sms-settings.controller';
import { SmsTemplatesService } from './sms-templates.service';
import { SmsTemplatesController } from './sms-templates.controller';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SmsLogController } from './sms-log.controller';
import { MailrelaySmsClient } from './mailrelay-sms.client';
import { DatabaseModule } from '../../database/database.module';
import { MoodleUserModule } from '../moodle-user/moodle-user.module';

@Module({
  imports: [DatabaseModule, MoodleUserModule],
  providers: [SmsSettingsService, SmsTemplatesService, SmsService, MailrelaySmsClient],
  controllers: [SmsSettingsController, SmsTemplatesController, SmsController, SmsLogController],
  exports: [SmsSettingsService, SmsTemplatesService, SmsService],
})
export class SmsModule {}
