import { Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { MailService, SendMailOptions, MoodleSenderChoice } from './mail.service';
import { SmtpSettingsDto } from '../../dto/mail/smtp-settings.dto';
import { RoleGuard } from '../../guards/role.guard';
import { Role } from '../../guards/role.enum';

interface SendMailFromTemplateDto {
  userId?: number;
  templateId: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  toEmail: string;
  sendViaMoodle?: boolean;
  authUserId?: number;
  moodleSenderChoice?: MoodleSenderChoice;
  tutorUserId?: number;
}

@Controller('mail')
export class MailController {
  constructor(
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailService: MailService,
  ) {}

  @Post('connection')
  @UseGuards(RoleGuard([Role.ADMIN]))
  async testConnection(@Body() body: SmtpSettingsDto) {
    // Si la contraseña llega vacía (el formulario no la reenvía cuando no se
    // cambia), usar la almacenada (descifrada) para probar la conexión.
    const pass = await this.resolveSmtpPassword(body.password);
    // Intenta crear un transporter y verificar la conexión
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: body.host,
      port: body.port,
      secure: body.secure,
      auth: {
        user: body.user,
        pass,
      },
    });
    await transporter.verify();
    return { ok: true };
  }

  /**
   * Devuelve la contraseña a usar para probar SMTP: la proporcionada si no está
   * vacía; en caso contrario, la almacenada (descifrada). Evita exigir al admin
   * reescribir la contraseña solo para probar la conexión.
   */
  private async resolveSmtpPassword(provided?: string): Promise<string | undefined> {
    if (provided !== undefined && provided !== null && provided !== '') return provided;
    const stored = await this.smtpSettingsService.getSettings();
    return stored?.password || undefined;
  }

  @Post('send')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  async sendTestMail(@Body() body: SendMailOptions & { smtp?: SmtpSettingsDto }) {
    // Si se pasa smtp, usarlo temporalmente para este envío
    if (body.smtp) {
      const pass = await this.resolveSmtpPassword(body.smtp.password);
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: body.smtp.host,
        port: body.smtp.port,
        secure: body.smtp.secure,
        auth: {
          user: body.smtp.user,
          pass,
        },
      });
      const fromEmail = body.smtp.from_email;
      const fromName = body.from_name || body.smtp.from_name;
      const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

      const recipients = Array.isArray(body.to)
        ? body.to.map((value) => String(value).trim().toLowerCase())
        : [String(body.to).trim().toLowerCase()];

      const replyToCandidate = body.reply_to?.trim();
      const safeReplyTo =
        replyToCandidate && !recipients.includes(replyToCandidate.toLowerCase())
          ? replyToCandidate
          : undefined;

      const mailOptions: any = {
        from,
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
      };

      if (safeReplyTo) {
        mailOptions.replyTo = safeReplyTo;
      }

      await transporter.sendMail(mailOptions);
      return { ok: true };
    } else {
      await this.mailService.sendMail(body);
      return { ok: true };
    }
  }

  @Post('send-from-template')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  async sendMailFromTemplate(@Body() body: SendMailFromTemplateDto) {
    await this.mailService.sendMailFromTemplate({
      to: body.toEmail,
      templateId: body.templateId,
      userId: body.userId,
      courseName: body.courseName,
      courseStart: body.courseStart,
      courseEnd: body.courseEnd,
      from_email: body.fromEmail,
      from_name: body.fromName,
      reply_to: body.replyTo,
      sendViaMoodle: body.sendViaMoodle,
      authUserId: body.authUserId,
      moodleSenderChoice: body.moodleSenderChoice,
      tutorUserId: body.tutorUserId,
    });
    return { success: true, message: 'Correo enviado correctamente' };
  }

  @Get('tutor-moodle-token-status/:tutorUserId')
  @UseGuards(RoleGuard([Role.ADMIN, Role.MANAGER, Role.VIEWER]))
  async tutorMoodleTokenStatus(@Param('tutorUserId', ParseIntPipe) tutorUserId: number) {
    const hasToken = await this.mailService.tutorHasMoodleToken(tutorUserId);
    return { hasToken };
  }
}
