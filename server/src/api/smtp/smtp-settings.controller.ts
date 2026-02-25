import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsDto } from '../../dto/smtp/smtp-settings.dto';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

@Controller('smtp-settings')
@UseGuards(RoleGuard([Role.ADMIN]))
export class SmtpSettingsController {
  constructor(private readonly smtpSettingsService: SmtpSettingsService) {}

  @Get()
  async getSettings() {
    console.log('[SMTP Controller] GET /smtp-settings called');
    const result = await this.smtpSettingsService.getSettings();
    console.log('[SMTP Controller] GET /smtp-settings result:', result);
    return result;
  }

  @Post()
  async saveSettings(@Body() body: SmtpSettingsDto) {
    console.log('[SMTP Controller] POST /smtp-settings called with:', body);
    const result = await this.smtpSettingsService.saveSettings(body);
    console.log('[SMTP Controller] POST /smtp-settings result:', result);
    return result;
  }
}
