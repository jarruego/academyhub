import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsDto } from '../../dto/mail/smtp-settings.dto';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

@Controller('smtp-settings')
export class SmtpSettingsController {
  constructor(private readonly smtpSettingsService: SmtpSettingsService) {}

  @Get()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  async getSettings() {
    return await this.smtpSettingsService.getSettings();
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  async saveSettings(@Body() body: SmtpSettingsDto) {
    return await this.smtpSettingsService.saveSettings(body);
  }
}
