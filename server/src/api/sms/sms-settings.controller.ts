import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SmsSettingsService } from './sms-settings.service';
import { SmsSettingsDto } from '../../dto/sms/sms-settings.dto';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

@Controller('sms-settings')
export class SmsSettingsController {
  constructor(private readonly smsSettingsService: SmsSettingsService) {}

  /**
   * Nunca exponer la api_key al cliente: se devuelve enmascarada ('') más un
   * flag `hasApiKey`. El formulario envía la api_key solo si el admin la
   * cambia; si llega vacía, el backend preserva la almacenada.
   */
  private mask(row: Awaited<ReturnType<SmsSettingsService['getSettings']>>) {
    if (!row) return null;
    const hasApiKey = typeof row.api_key === 'string' && row.api_key.length > 0;
    return { ...row, api_key: '', hasApiKey };
  }

  @Get()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER, Role.TUTOR, Role.CONSULTOR]))
  async getSettings() {
    return this.mask(await this.smsSettingsService.getSettings());
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  async saveSettings(@Body() body: SmsSettingsDto) {
    return this.mask(await this.smsSettingsService.saveSettings(body));
  }
}
