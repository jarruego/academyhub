import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { MailService, SendMailOptions } from './mail.service';
import { SmtpSettingsDto } from '../../dto/smtp/smtp-settings.dto';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

@Controller('smtp-test')
@UseGuards(RoleGuard([Role.ADMIN]))
export class SmtpTestController {
  constructor(
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailService: MailService,
  ) {}

  @Post('connection')
  async testConnection(@Body() body: SmtpSettingsDto) {
    // Intenta crear un transporter y verificar la conexión
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: body.host,
      port: body.port,
      secure: body.secure,
      auth: {
        user: body.user,
        pass: body.password,
      },
    });
    await transporter.verify();
    return { ok: true };
  }

  @Post('send')
  async sendTestMail(@Body() body: SendMailOptions & { smtp?: SmtpSettingsDto }) {
    // Si se pasa smtp, usarlo temporalmente para este envío
    if (body.smtp) {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: body.smtp.host,
        port: body.smtp.port,
        secure: body.smtp.secure,
        auth: {
          user: body.smtp.user,
          pass: body.smtp.password,
        },
      });
      const fromEmail = body.from_email || body.smtp.from_email;
      const fromName = body.from_name || body.smtp.from_name;
      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
      await transporter.sendMail({
        from,
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
      });
      return { ok: true };
    } else {
      await this.mailService.sendMail(body);
      return { ok: true };
    }
  }
}
