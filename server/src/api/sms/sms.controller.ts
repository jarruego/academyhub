import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { SmsService, SmsActor } from './sms.service';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';
import { SendSmsDto } from '../../dto/sms/send-sms.dto';
import { SendSmsFromTemplateDto } from '../../dto/sms/send-sms-from-template.dto';
import { SmsSettingsDto } from '../../dto/sms/sms-settings.dto';
import { SmsPreviewLengthDto } from '../../dto/sms/sms-preview-length.dto';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /** Extrae el actor autenticado (del JWT) para auditar el envío en sms_log. */
  private actorFromReq(req: any): SmsActor | undefined {
    const user = req?.user;
    if (!user) return undefined;
    return { id: user.id, username: user.username, role: user.role };
  }

  @Post('connection')
  @UseGuards(RoleGuard([Role.ADMIN]))
  async testConnection(@Body() body: SmsSettingsDto) {
    await this.smsService.testConnection({ accountUrl: body.account_url, apiKey: body.api_key });
    return { ok: true };
  }

  // Solo ADMIN/MANAGER (decisión 2026-09-11): a diferencia del correo, TUTOR
  // no tiene botón "SMS" en la pantalla de grupo.
  @Post('send')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  async sendSms(@Body() body: SendSmsDto, @Req() req: any) {
    await this.smsService.sendSms({
      to: body.to,
      message: body.message,
      senderName: body.senderName,
      actor: this.actorFromReq(req),
    });
    return { ok: true };
  }

  /** Longitud/partes del SMS ya resuelto (variables + pie de baja), sin enviarlo ni exponer el texto. */
  @Post('preview-length')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  async previewLength(@Body() body: SmsPreviewLengthDto) {
    return this.smsService.previewLength(body);
  }

  @Post('send-from-template')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER]))
  async sendSmsFromTemplate(@Body() body: SendSmsFromTemplateDto, @Req() req: any) {
    await this.smsService.sendSmsFromTemplate({
      to: body.toPhone,
      templateId: body.templateId,
      userId: body.userId,
      courseName: body.courseName,
      courseStart: body.courseStart,
      courseEnd: body.courseEnd,
      senderName: body.senderName,
      actor: this.actorFromReq(req),
    });
    return { success: true, message: 'SMS enviado correctamente' };
  }
}
