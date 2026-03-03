import { Injectable } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { MailTemplatesService } from './mail-templates.service';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { MoodleMessageService } from './moodle-message.service';
import { AuthUserRepository } from 'src/database/repository/auth/auth_user.repository';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  sendViaMoodle?: boolean;
  authUserId?: number;
  userId?: number;
}

export interface SendMailFromTemplateOptions {
  to: string | string[];
  templateId: number;
  userId?: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  sendViaMoodle?: boolean;
  authUserId?: number;
}

@Injectable()
export class MailService {
  constructor(
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailTemplatesService: MailTemplatesService,
    private readonly moodleUserRepository: MoodleUserRepository,
    private readonly moodleMessageService: MoodleMessageService,
    private readonly authUserRepository: AuthUserRepository,
  ) {}

  async sendMail(options: SendMailOptions) {
    if (options.sendViaMoodle) {
      console.log('[MailService] Enviando vía Moodle:', { 
        userId: options.userId,
        subject: options.subject, 
        authUserId: options.authUserId 
      });
      
      // Obtener token del usuario autenticado si está disponible
      let token: string | undefined;
      if (options.authUserId) {
        const authUser = await this.authUserRepository.findById(options.authUserId);
        token = authUser?.moodleToken ?? undefined;
        console.log('[MailService] Token del usuario autenticado:', token ? 'Disponible' : 'No disponible');
      }

      let messageText = options.html || options.text || '';
      
      // Siempre enviar como HTML a Moodle, convirtiendo saltos de línea
      messageText = messageText.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');

      // Obtener el ID de Moodle directamente del userId
      if (!options.userId) {
        throw new Error('userId es requerido para enviar mensajes vía Moodle');
      }

      try {
        const moodleUsers = await this.moodleUserRepository.findByUserId(options.userId);
        console.log('[MailService] Usuarios de Moodle encontrados para userId', options.userId, ':', moodleUsers.length);
        
        if (moodleUsers.length > 0) {
          const moodleUser = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
          console.log('[MailService] Enviando a Moodle user ID:', moodleUser.moodle_id);
          console.log('[MailService] Contenido (primeros 200 chars):', messageText.substring(0, 200));
          
          await this.moodleMessageService.sendMessage({
            toUserId: moodleUser.moodle_id,
            text: messageText,
            textFormat: 1, // Siempre HTML
            token,
          });
          
          console.log('[MailService] Mensaje enviado correctamente a Moodle');
        } else {
          throw new Error(`No se encontró usuario de Moodle para userId ${options.userId}`);
        }
      } catch (error) {
        console.error('[MailService] Error al enviar mensaje de Moodle:', error);
        throw error;
      }
      // Continuar para enviar también por SMTP
    }

    // Envío normal por SMTP
    const smtp = await this.smtpSettingsService.getSettings();
    if (!smtp) throw new Error('SMTP settings not configured');

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    const fromEmail = smtp.from_email;
    const fromName = options.from_name || smtp.from_name;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    const recipients = Array.isArray(options.to)
      ? options.to.map((value) => String(value).trim().toLowerCase())
      : [String(options.to).trim().toLowerCase()];

    const replyToCandidate = options.reply_to?.trim();
    const safeReplyTo =
      replyToCandidate && !recipients.includes(replyToCandidate.toLowerCase())
        ? replyToCandidate
        : undefined;

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (safeReplyTo) {
      mailOptions.replyTo = safeReplyTo;
    }

    await transporter.sendMail(mailOptions);
  }

  async sendMailFromTemplate(options: SendMailFromTemplateOptions) {
    const template = await this.mailTemplatesService.findById(options.templateId);
    if (!template) throw new Error('Template not found');

    const variables: Record<string, string> = {
      '{NOMBRE_CURSO}': options.courseName ?? '',
      '{FECHA_INICIO}': options.courseStart ?? '',
      '{FECHA_FIN}': options.courseEnd ?? '',
      '{USUARIO_MOODLE}': '',
      '{CLAVE_MOODLE}': '',
    };

    if (options.userId) {
      const moodleUsers = await this.moodleUserRepository.findByUserId(options.userId);
      const main = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
      if (main) {
        variables['{USUARIO_MOODLE}'] = main.moodle_username ?? '';
        variables['{CLAVE_MOODLE}'] = main.moodle_password ?? '';
      }
    }

    const applyVariables = (input: string) =>
      Object.entries(variables).reduce((acc, [key, value]) => acc.replaceAll(key, value ?? ''), input);

    const subject = applyVariables(template.subject || template.name);
    const content = applyVariables(template.content);

    await this.sendMail({
      to: options.to,
      subject,
      html: template.is_html ? content : undefined,
      text: !template.is_html ? content : undefined,
      from_email: options.from_email,
      from_name: options.from_name,
      reply_to: options.reply_to,
      sendViaMoodle: options.sendViaMoodle,
      authUserId: options.authUserId,
      userId: options.userId,
    });
  }
}
