import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SmsSettingsService } from './sms-settings.service';
import { SmsTemplatesService } from './sms-templates.service';
import { MailrelaySmsClient, MailrelaySmsCredentials } from './mailrelay-sms.client';
import { MoodleUserRepository } from '../../database/repository/moodle-user/moodle-user.repository';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { SmsLogRepository, SmsLogQuery } from '../../database/repository/sms/sms-log.repository';
import { toE164Phone } from '../../utils/phone.util';

// Actor que origina el envío (tomado del JWT en el controller, no del body).
export interface SmsActor {
  id?: number;
  username?: string;
  role?: string;
}

export interface SendSmsOptions {
  to: string;
  message: string;
  senderName?: string;
  actor?: SmsActor;
  templateId?: number;
  templateName?: string;
}

export interface SendSmsFromTemplateOptions {
  to: string;
  templateId: number;
  userId?: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
  senderName?: string;
  actor?: SmsActor;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly smsLogRepo: SmsLogRepository;

  constructor(
    private readonly smsSettingsService: SmsSettingsService,
    private readonly smsTemplatesService: SmsTemplatesService,
    private readonly mailrelaySmsClient: MailrelaySmsClient,
    private readonly moodleUserRepository: MoodleUserRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {
    this.smsLogRepo = new SmsLogRepository(this.databaseService.db);
  }

  /**
   * Arma el record de variables tipo {NOMBRE_CURSO} disponibles para
   * plantillas SMS. Duplicado de MailService.buildTemplateVariables/
   * applyVariables a propósito: no hay helper compartido (mismo criterio ya
   * documentado en docs/mail-moodle.md para MailService.resolveToken).
   */
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

  private async resolveCredentials(): Promise<MailrelaySmsCredentials> {
    const settings = await this.smsSettingsService.getSettings();
    if (!settings) throw new BadRequestException('SMS settings not configured');
    return { accountUrl: settings.account_url, apiKey: settings.api_key };
  }

  /**
   * Permite probar la conexión con los valores del formulario aún no
   * guardados (igual que SmtpSettingsController.resolveSmtpPassword): si no
   * se pasa api_key (campo vacío = "mantener la actual"), se usa la ya
   * almacenada.
   */
  async testConnection(inline?: { accountUrl: string; apiKey?: string }): Promise<void> {
    let creds: MailrelaySmsCredentials;
    if (inline) {
      let apiKey = inline.apiKey;
      if (!apiKey) {
        const stored = await this.smsSettingsService.getSettings();
        apiKey = stored?.api_key;
      }
      if (!apiKey) throw new BadRequestException('Falta la API key de Mailrelay');
      creds = { accountUrl: inline.accountUrl, apiKey };
    } else {
      creds = await this.resolveCredentials();
    }
    await this.mailrelaySmsClient.ping(creds);
  }

  /**
   * Registra un envío de SMS en sms_log (best-effort: nunca lanza ni bloquea
   * el envío). NO guarda el texto del mensaje (puede contener {CLAVE_MOODLE}).
   */
  private async recordSmsLog(entry: {
    actor?: SmsActor;
    recipient?: string;
    templateId?: number | null;
    templateName?: string | null;
    senderName?: string | null;
    mailrelayId?: number | null;
    status: 'sent' | 'failed';
    error?: string | null;
  }): Promise<void> {
    try {
      await this.smsLogRepo.create({
        actor_id: typeof entry.actor?.id === 'number' ? entry.actor.id : null,
        actor_username: entry.actor?.username ? String(entry.actor.username).slice(0, 64) : null,
        actor_role: entry.actor?.role ? String(entry.actor.role).slice(0, 16) : null,
        recipient: entry.recipient ? entry.recipient.slice(0, 32) : null,
        template_id: typeof entry.templateId === 'number' ? entry.templateId : null,
        template_name: entry.templateName ? String(entry.templateName).slice(0, 128) : null,
        sender_name: entry.senderName ? String(entry.senderName).slice(0, 64) : null,
        mailrelay_id: typeof entry.mailrelayId === 'number' ? entry.mailrelayId : null,
        status: entry.status,
        error_message: entry.error ? String(entry.error).slice(0, 1000) : null,
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar sms_log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Mailrelay exige que todo SMS incluya un enlace/placeholder de baja
   * (rechaza con 422 "Your campaign must contain an unsubscribe URL" si no lo
   * lleva) — lo añade automáticamente si la plantilla o el mensaje libre no
   * lo trae, para que ninguna plantilla creada sin saberlo rompa el envío.
   */
  private ensureUnsubscribeUrl(message: string): string {
    const placeholder = '{{ unsubscribe_url }}';
    return message.includes(placeholder) ? message : `${message}\n${placeholder}`;
  }

  async sendSms(options: SendSmsOptions): Promise<void> {
    const creds = await this.resolveCredentials();
    const settings = await this.smsSettingsService.getSettings();
    const senderName = options.senderName || settings?.sender_name;
    if (!senderName) throw new BadRequestException('Falta el nombre del remitente (sender_name)');

    const phone = toE164Phone(options.to);
    if (!phone) throw new BadRequestException(`Teléfono inválido: ${options.to}`);

    const logBase = {
      actor: options.actor,
      recipient: phone,
      templateId: options.templateId ?? null,
      templateName: options.templateName ?? null,
      senderName,
    };

    try {
      const result = await this.mailrelaySmsClient.sendSms(creds, {
        to: [phone],
        sender_name: senderName,
        message: this.ensureUnsubscribeUrl(options.message),
      });
      await this.recordSmsLog({
        ...logBase,
        mailrelayId: result?.[0]?.id ?? null,
        status: 'sent',
        error: null,
      });
    } catch (err) {
      await this.recordSmsLog({ ...logBase, status: 'failed', error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  async sendSmsFromTemplate(options: SendSmsFromTemplateOptions): Promise<void> {
    const template = await this.smsTemplatesService.findById(options.templateId);
    if (!template) throw new BadRequestException('Plantilla SMS no encontrada');

    const variables = await this.buildTemplateVariables(
      options.userId,
      options.courseName,
      options.courseStart,
      options.courseEnd,
    );

    const message = this.applyVariables(template.message, variables);

    await this.sendSms({
      to: options.to,
      message,
      senderName: options.senderName,
      actor: options.actor,
      templateId: options.templateId,
      templateName: template.name,
    });
  }

  /** Refresca el estado real de entrega en Mailrelay para una fila del registro (botón manual). */
  async refreshLogStatus(logId: number) {
    const row = await this.smsLogRepo.findById(logId);
    if (!row) throw new BadRequestException('Registro de SMS no encontrado');
    if (!row.mailrelay_id) throw new BadRequestException('Este envío no tiene id de Mailrelay para consultar su estado');

    const creds = await this.resolveCredentials();
    const sentMessage = await this.mailrelaySmsClient.getSentMessage(creds, row.mailrelay_id);

    return this.smsLogRepo.update(logId, {
      mailrelay_status: sentMessage.status,
      mailrelay_status_checked_at: new Date(),
      parts_count: sentMessage.parts_count ?? row.parts_count ?? null,
      used_credits: typeof sentMessage.used_credits === 'number' ? String(sentMessage.used_credits) : row.used_credits,
    });
  }

  async listLog(query: SmsLogQuery) {
    return this.smsLogRepo.list(query);
  }
}
