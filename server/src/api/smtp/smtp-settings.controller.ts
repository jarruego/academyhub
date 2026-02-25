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
    const result = await this.smtpSettingsService.getSettings();
    return result;
  }

  @Post()
  async saveSettings(@Body() body: SmtpSettingsDto) {
    const result = await this.smtpSettingsService.saveSettings(body);
    return result;
  }
}
