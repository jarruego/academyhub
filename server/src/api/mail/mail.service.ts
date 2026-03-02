import { Injectable } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { MailTemplatesService } from './mail-templates.service';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
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
}

@Injectable()
export class MailService {
  constructor(
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailTemplatesService: MailTemplatesService,
    private readonly moodleUserRepository: MoodleUserRepository,
  ) {}

  async sendMail(options: SendMailOptions) {
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

    const fromEmail = options.from_email || smtp.from_email;
    const fromName = options.from_name || smtp.from_name;
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.reply_to,
    });
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
    });
  }
}
