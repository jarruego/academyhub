import { Inject, Injectable, Logger } from '@nestjs/common';
import { SmtpSettingsService } from './smtp-settings.service';
import { MailTemplatesService } from './mail-templates.service';
import { MoodleUserRepository } from 'src/database/repository/moodle-user/moodle-user.repository';
import { MoodleMessageService } from './moodle-message.service';
import { AuthUserRepository } from 'src/database/repository/auth/auth_user.repository';
import { MoodleService } from '../moodle/moodle.service';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { email_log } from 'src/database/schema';
import * as nodemailer from 'nodemailer';

export type MoodleSenderChoice = 'default' | 'auth' | 'tutor';

// Actor que origina el envío (tomado del JWT en el controller, no del body).
export interface EmailActor {
  id?: number;
  username?: string;
  role?: string;
}

export interface SendMailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  // Adjuntos binarios (p. ej. PDFs de informes). Solo viajan por SMTP: la
  // notificación por Moodle (sendViaMoodle) no admite adjuntos, se envía como
  // texto igualmente.
  attachments?: SendMailAttachment[];
  sendViaMoodle?: boolean;
  authUserId?: number;
  userId?: number;
  moodleSenderChoice?: MoodleSenderChoice;
  tutorUserId?: number;
  // Auditoría de correo (rellenado internamente / por el controller)
  actor?: EmailActor;
  templateId?: number;
  templateName?: string;
  // Sustitución de variables tipo {NOMBRE_CURSO} en subject/html/text antes de
  // enviar (usado por el correo personalizado; las plantillas ya llegan
  // sustituidas desde sendMailFromTemplate, así que no se activa por defecto).
  applyVariables?: boolean;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
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
  moodleSenderChoice?: MoodleSenderChoice;
  tutorUserId?: number;
  actor?: EmailActor;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly smtpSettingsService: SmtpSettingsService,
    private readonly mailTemplatesService: MailTemplatesService,
    private readonly moodleUserRepository: MoodleUserRepository,
    private readonly moodleMessageService: MoodleMessageService,
    private readonly authUserRepository: AuthUserRepository,
    private readonly moodleService: MoodleService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Registra un envío de correo en email_log (best-effort: nunca lanza ni
   * bloquea el envío). NO guarda el cuerpo del correo (contiene contraseñas).
   */
  private async recordEmailLog(entry: {
    actor?: EmailActor;
    recipient?: string;
    subject?: string;
    templateId?: number | null;
    templateName?: string | null;
    senderMode?: string;
    fromName?: string | null;
    fromEmail?: string | null;
    viaMoodle?: boolean;
    status: 'sent' | 'failed';
    error?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.databaseService.db.insert(email_log).values({
        actor_id: typeof entry.actor?.id === 'number' ? entry.actor.id : null,
        actor_username: entry.actor?.username ? String(entry.actor.username).slice(0, 64) : null,
        actor_role: entry.actor?.role ? String(entry.actor.role).slice(0, 16) : null,
        recipient: entry.recipient ? entry.recipient.slice(0, 2000) : null,
        subject: entry.subject ? entry.subject.slice(0, 2000) : null,
        template_id: typeof entry.templateId === 'number' ? entry.templateId : null,
        template_name: entry.templateName ? String(entry.templateName).slice(0, 128) : null,
        sender_mode: entry.senderMode ? String(entry.senderMode).slice(0, 16) : null,
        from_name: entry.fromName ? String(entry.fromName).slice(0, 255) : null,
        from_email: entry.fromEmail ? String(entry.fromEmail).slice(0, 255) : null,
        via_moodle: !!entry.viaMoodle,
        status: entry.status,
        error_message: entry.error ? String(entry.error).slice(0, 1000) : null,
        notes: entry.notes ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar email_log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async resolveToken(
    choice: MoodleSenderChoice | undefined,
    authUserId: number | undefined,
    tutorUserId: number | undefined,
  ): Promise<string | undefined> {
    if (!choice || choice === 'default') return this.moodleService.resolveMoodleToken();

    if (choice === 'auth' && authUserId) {
      const link = await this.authUserRepository.findTopMoodleLinkByAuthUserId(authUserId);
      return link?.moodle_token ?? undefined;
    }

    if (choice === 'tutor' && tutorUserId) {
      const moodleUsers = await this.moodleUserRepository.findByUserId(tutorUserId);
      const moodleUser = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
      if (moodleUser) {
        const link = await this.authUserRepository.findTopMoodleLinkByMoodleUserId(moodleUser.id_moodle_user);
        if (link?.moodle_token) return link.moodle_token;
      }
    }

    return undefined;
  }

  /** Arma el record de variables tipo {NOMBRE_CURSO} disponibles para plantillas y correo personalizado. */
  private async buildTemplateVariables(
    userId?: number,
    courseName?: string,
    courseStart?: string,
    courseEnd?: string,
  ): Promise<Record<string, string>> {
    const variables: Record<string, string> = {
      '{NOMBRE_CURSO}': courseName ?? '',
      '{FECHA_INICIO}': courseStart ?? '',
      '{FECHA_FIN}': courseEnd ?? '',
      '{USUARIO_MOODLE}': '',
      '{CLAVE_MOODLE}': '',
    };

    if (userId) {
      const moodleUsers = await this.moodleUserRepository.findByUserId(userId);
      const main = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
      if (main) {
        variables['{USUARIO_MOODLE}'] = main.moodle_username ?? '';
        variables['{CLAVE_MOODLE}'] = main.moodle_password ?? '';
      }
    }

    return variables;
  }

  private applyVariables(input: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce((acc, [key, value]) => acc.replaceAll(key, value ?? ''), input);
  }

  /** Sustituye variables en subject/html/text cuando options.applyVariables está activo. */
  private async withAppliedVariables(options: SendMailOptions): Promise<SendMailOptions> {
    if (!options.applyVariables) return options;

    const variables = await this.buildTemplateVariables(
      options.userId,
      options.courseName,
      options.courseStart,
      options.courseEnd,
    );

    return {
      ...options,
      subject: this.applyVariables(options.subject, variables),
      html: options.html !== undefined ? this.applyVariables(options.html, variables) : options.html,
      text: options.text !== undefined ? this.applyVariables(options.text, variables) : options.text,
    };
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const resolvedOptions = await this.withAppliedVariables(options);
    const recipient = Array.isArray(resolvedOptions.to) ? resolvedOptions.to.join(', ') : String(resolvedOptions.to ?? '');
    const logBase = {
      actor: resolvedOptions.actor,
      recipient,
      subject: resolvedOptions.subject,
      templateId: resolvedOptions.templateId ?? null,
      templateName: resolvedOptions.templateName ?? null,
      senderMode: resolvedOptions.moodleSenderChoice ?? 'default',
      fromName: resolvedOptions.from_name ?? null,
      viaMoodle: !!resolvedOptions.sendViaMoodle,
    };
    try {
      const sent = await this.deliverMail(resolvedOptions);
      await this.recordEmailLog({
        ...logBase,
        // Remitente real resuelto en el envío (lo que ve el destinatario)
        fromName: sent?.fromName ?? logBase.fromName,
        fromEmail: sent?.fromEmail ?? null,
        status: 'sent',
        error: null,
      });
    } catch (err) {
      await this.recordEmailLog({ ...logBase, status: 'failed', error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Envío real del correo (Moodle + SMTP). Devuelve el remitente resuelto
   * (nombre y correo que ve el destinatario) para registrarlo. El registro en
   * email_log lo hace sendMail.
   */
  private async deliverMail(options: SendMailOptions): Promise<{ fromEmail: string; fromName: string | null }> {
    if (options.sendViaMoodle) {
      const token = await this.resolveToken(
        options.moodleSenderChoice,
        options.authUserId,
        options.tutorUserId,
      );

      let messageText = options.html || options.text || '';
      
      // Siempre enviar como HTML a Moodle, convirtiendo saltos de línea
      messageText = messageText.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');

      // Obtener el ID de Moodle directamente del userId
      if (!options.userId) {
        throw new Error('userId es requerido para enviar mensajes vía Moodle');
      }

      try {
        const moodleUsers = await this.moodleUserRepository.findByUserId(options.userId);
        if (moodleUsers.length > 0) {
          const moodleUser = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
          await this.moodleMessageService.sendMessage({
            toUserId: moodleUser.moodle_id,
            text: messageText,
            textFormat: 1,
            token,
          });
        } else {
          throw new Error(`No se encontró usuario de Moodle para userId ${options.userId}`);
        }
      } catch (error) {
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

    if (options.attachments?.length) {
      mailOptions.attachments = options.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    }

    await transporter.sendMail(mailOptions);

    return { fromEmail, fromName: fromName ?? null };
  }

  async sendMailFromTemplate(options: SendMailFromTemplateOptions) {
    const template = await this.mailTemplatesService.findById(options.templateId);
    if (!template) throw new Error('Template not found');

    const variables = await this.buildTemplateVariables(
      options.userId,
      options.courseName,
      options.courseStart,
      options.courseEnd,
    );

    const subject = this.applyVariables(template.subject || template.name, variables);
    const content = this.applyVariables(template.content, variables);

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
      moodleSenderChoice: options.moodleSenderChoice,
      tutorUserId: options.tutorUserId,
      actor: options.actor,
      templateId: options.templateId,
      templateName: template.name,
    });
  }

  async tutorHasMoodleToken(tutorUserId: number): Promise<boolean> {
    const moodleUsers = await this.moodleUserRepository.findByUserId(tutorUserId);
    const moodleUser = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
    if (!moodleUser) return false;
    const link = await this.authUserRepository.findTopMoodleLinkByMoodleUserId(moodleUser.id_moodle_user);
    return !!link?.moodle_token;
  }
}
