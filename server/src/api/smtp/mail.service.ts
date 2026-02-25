import { Injectable } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
}

@Injectable()
export class MailService {
  constructor(private readonly smtpSettingsService: SmtpSettingsService) {}

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
    });
  }
}
