import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { SmtpSettingsDto } from '../../dto/mail/smtp-settings.dto';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

@Controller('smtp-settings')
export class SmtpSettingsController {
  constructor(private readonly smtpSettingsService: SmtpSettingsService) {}

  /**
   * Nunca exponer la contraseña al cliente: se devuelve enmascarada ('') más un
   * flag `hasPassword`. El formulario envía la contraseña solo si el admin la
   * cambia; si llega vacía, el backend preserva la almacenada.
   */
  private mask(row: Awaited<ReturnType<SmtpSettingsService['getSettings']>>) {
    if (!row) return null;
    const hasPassword = typeof row.password === 'string' && row.password.length > 0;
    return { ...row, password: '', hasPassword };
  }

  @Get()
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  async getSettings() {
    return this.mask(await this.smtpSettingsService.getSettings());
  }

  @Post()
  @UseGuards(RoleGuard([Role.ADMIN]))
  async saveSettings(@Body() body: SmtpSettingsDto) {
    return this.mask(await this.smtpSettingsService.saveSettings(body));
  }
}
