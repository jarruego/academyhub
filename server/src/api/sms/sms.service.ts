import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SmsSettingsService } from './sms-settings.service';
import { SmsTemplatesService } from './sms-templates.service';
import { MailrelaySmsClient, MailrelaySmsCredentials } from './mailrelay-sms.client';
import { MoodleUserRepository } from '../../database/repository/moodle-user/moodle-user.repository';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { SmsLogRepository, SmsLogQuery } from '../../database/repository/sms/sms-log.repository';
import { toE164Phone } from '../../utils/phone.util';
import { estimateSmsLength, SmsLengthInfo } from '../../utils/sms/sms-length.util';

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
  // Sustituye variables tipo {NOMBRE_CURSO} en `message` antes de enviar
  // (usado por el mensaje personalizado/editado del envío a grupo; las
  // plantillas ya llegan sustituidas desde sendSmsFromTemplate).
  applyVariables?: boolean;
  userId?: number;
  courseName?: string;
  courseShortName?: string;
  courseStart?: string;
  courseEnd?: string;
}

export interface SendSmsFromTemplateOptions {
  to: string;
  templateId: number;
  userId?: number;
  courseName?: string;
  courseShortName?: string;
  courseStart?: string;
  courseEnd?: string;
  senderName?: string;
  actor?: SmsActor;
}

export interface PreviewSmsLengthOptions {
  // Exactamente uno de los dos: `templateId` (plantilla guardada) o `message`
  // (texto editado ad-hoc, aún sin guardar como plantilla).
  templateId?: number;
  message?: string;
  userId?: number;
  courseName?: string;
  courseShortName?: string;
  courseStart?: string;
  courseEnd?: string;
}

export interface PreviewSmsBatchOptions {
  userIds: number[];
  templateId?: number;
  message?: string;
  courseName?: string;
  courseShortName?: string;
  courseStart?: string;
  courseEnd?: string;
}

export interface SmsBatchPreviewResult {
  userId: number;
  missingVariables: string[];
  length: number;
  parts: number;
  exceedsLimit: boolean;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly smsLogRepo: SmsLogRepository;
  // Política de coste: cada envío debe caber en 1 SMS (160 caracteres GSM-7 /
  // 70 UCS-2), incluido el pie "Baja SMS: {{ unsubscribe_url }}". Decisión
  // explícita del usuario 2026-09-11 — no enviar SMS multi-parte.
  private readonly MAX_SMS_PARTS = 1;

  // Variables que siempre deben tener valor si aparecen en el mensaje: vienen
  // del grupo/curso, no de un alumno concreto, así que no hay caso legítimo
  // en el que deban quedar vacías (a diferencia de USUARIO_MOODLE/CLAVE_MOODLE
  // en el envío de prueba, donde no hay un alumno real — ver más abajo).
  private readonly ALWAYS_REQUIRED_VARIABLES = ['{NOMBRE_CURSO}', '{NOMBRE_CURSO_CORTO}', '{FECHA_INICIO}', '{FECHA_FIN}'];
  // Solo exigibles cuando el envío sí tiene un alumno real (userId): en el
  // envío de prueba (sin userId) quedan vacías a propósito, documentado en
  // docs/sms.md — no se bloquean ahí.
  private readonly USER_REQUIRED_VARIABLES = ['{USUARIO_MOODLE}', '{CLAVE_MOODLE}'];

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
   * Arma el record de variables tipo {NOMBRE_CURSO} a partir de las cuentas
   * de Moodle ya resueltas de un alumno (posiblemente ninguna) — parte pura
   * de `buildTemplateVariables`, separada para poder reutilizarla en
   * `previewBatch` sin repetir una consulta de Moodle por alumno.
   */
  private buildVariablesFromMoodleUsers(
    courseName: string | undefined,
    courseStart: string | undefined,
    courseEnd: string | undefined,
    courseShortName: string | undefined,
    moodleUsers: Array<{ is_main_user: boolean; moodle_username: string | null; moodle_password: string | null }>,
  ): Record<string, string> {
    const variables: Record<string, string> = {
      '{NOMBRE_CURSO}': courseName ?? '',
      '{NOMBRE_CURSO_CORTO}': courseShortName ?? '',
      '{FECHA_INICIO}': courseStart ?? '',
      '{FECHA_FIN}': courseEnd ?? '',
      '{USUARIO_MOODLE}': '',
      '{CLAVE_MOODLE}': '',
    };

    const main = moodleUsers.find((mu) => mu.is_main_user) ?? moodleUsers[0];
    if (main) {
      variables['{USUARIO_MOODLE}'] = main.moodle_username ?? '';
      variables['{CLAVE_MOODLE}'] = main.moodle_password ?? '';
    }

    return variables;
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
    courseShortName?: string,
  ): Promise<Record<string, string>> {
    const moodleUsers = userId ? await this.moodleUserRepository.findByUserId(userId) : [];
    return this.buildVariablesFromMoodleUsers(courseName, courseStart, courseEnd, courseShortName, moodleUsers);
  }

  private applyVariables(input: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce((acc, [key, value]) => acc.replaceAll(key, value ?? ''), input);
  }

  /**
   * Variables que el mensaje usa (aparecen literalmente en `rawMessage`) pero
   * no tienen valor con el que sustituirlas — para bloquear el envío antes de
   * mandar un SMS con huecos en blanco. `hasUser` decide si además exige
   * USUARIO_MOODLE/CLAVE_MOODLE (solo tiene sentido cuando hay un alumno real).
   */
  private findMissingVariables(rawMessage: string, variables: Record<string, string>, hasUser: boolean): string[] {
    const required = hasUser ? [...this.ALWAYS_REQUIRED_VARIABLES, ...this.USER_REQUIRED_VARIABLES] : this.ALWAYS_REQUIRED_VARIABLES;
    return required.filter((key) => rawMessage.includes(key) && !variables[key]);
  }

  /** Lanza si el mensaje usa alguna variable sin valor — ver `findMissingVariables`. */
  private assertVariablesHaveValue(rawMessage: string, variables: Record<string, string>, hasUser: boolean): void {
    const missing = this.findMissingVariables(rawMessage, variables, hasUser);
    if (missing.length > 0) {
      throw new BadRequestException(
        `El mensaje usa ${missing.join(', ')} pero no hay valor para sustituir${hasUser ? ' (revisa el curso o el alumno)' : ' (revisa el curso)'} — no se ha enviado nada.`,
      );
    }
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
    return message.includes(placeholder) ? message : `${message}\nBaja SMS: ${placeholder}`;
  }

  /**
   * Valida que el mensaje final (ya con variables sustituidas y el pie de
   * baja) quepa en el límite de coste (`MAX_SMS_PARTS`). Lanza si se supera —
   * el mensaje incluye el recuento para que el usuario sepa cuánto recortar.
   */
  private assertWithinLengthLimit(finalMessage: string): SmsLengthInfo {
    const info = estimateSmsLength(finalMessage);
    if (info.parts > this.MAX_SMS_PARTS) {
      const limit = info.encoding === 'GSM-7' ? 160 : 70;
      throw new BadRequestException(
        `El SMS supera el límite de ${limit} caracteres (1 SMS): tiene ${info.length} caracteres y ocuparía ${info.parts} partes. Acorta la plantilla o el mensaje.`,
      );
    }
    return info;
  }

  /** Sustituye variables en `message` cuando options.applyVariables está activo (mensaje personalizado/editado). */
  private async withAppliedVariables(options: SendSmsOptions): Promise<string> {
    if (!options.applyVariables) return options.message;
    const variables = await this.buildTemplateVariables(
      options.userId,
      options.courseName,
      options.courseStart,
      options.courseEnd,
      options.courseShortName,
    );
    this.assertVariablesHaveValue(options.message, variables, !!options.userId);
    return this.applyVariables(options.message, variables);
  }

  async sendSms(options: SendSmsOptions): Promise<void> {
    const creds = await this.resolveCredentials();
    const settings = await this.smsSettingsService.getSettings();
    const senderName = options.senderName || settings?.sender_name;
    if (!senderName) throw new BadRequestException('Falta el nombre del remitente (sender_name)');

    const phone = toE164Phone(options.to);
    if (!phone) throw new BadRequestException(`Teléfono inválido: ${options.to}`);

    const resolvedMessage = await this.withAppliedVariables(options);
    const finalMessage = this.ensureUnsubscribeUrl(resolvedMessage);

    const logBase = {
      actor: options.actor,
      recipient: phone,
      templateId: options.templateId ?? null,
      templateName: options.templateName ?? null,
      senderName,
    };

    try {
      this.assertWithinLengthLimit(finalMessage);
      const result = await this.mailrelaySmsClient.sendSms(creds, {
        to: [phone],
        sender_name: senderName,
        message: finalMessage,
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
      options.courseShortName,
    );

    this.assertVariablesHaveValue(template.message, variables, !!options.userId);
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

  /** Resuelve el texto sin sustituir a partir de `templateId` o `message` — usado por `previewLength`/`previewBatch`. */
  private async resolveRawMessage(options: { templateId?: number; message?: string }): Promise<string> {
    if (options.message !== undefined) return options.message;
    if (options.templateId) {
      const template = await this.smsTemplatesService.findById(options.templateId);
      if (!template) throw new BadRequestException('Plantilla SMS no encontrada');
      return template.message;
    }
    throw new BadRequestException('Falta templateId o message');
  }

  /**
   * Calcula la longitud/partes del SMS ya resuelto (variables + pie de baja)
   * para un alumno y curso concretos, y además una vista previa del texto —
   * para avisar antes de enviar si se supera `MAX_SMS_PARTS` y para que el
   * usuario compruebe que las variables se están sustituyendo bien. La
   * longitud se calcula sobre el mensaje real (con {USUARIO_MOODLE}/
   * {CLAVE_MOODLE} reales si los hay, para que el recuento sea exacto), pero
   * el texto de la vista previa los enmascara: la clave de Moodle nunca debe
   * quedar expuesta en una respuesta de API que un admin puede ver en pantalla
   * sin más contexto que "estoy comprobando el SMS".
   */
  async previewLength(options: PreviewSmsLengthOptions): Promise<SmsLengthInfo & { limitParts: number; preview: string; missingVariables: string[] }> {
    const rawMessage = await this.resolveRawMessage(options);

    const variables = await this.buildTemplateVariables(
      options.userId,
      options.courseName,
      options.courseStart,
      options.courseEnd,
      options.courseShortName,
    );

    const finalMessage = this.ensureUnsubscribeUrl(this.applyVariables(rawMessage, variables));

    const maskedVariables = { ...variables };
    if (maskedVariables['{USUARIO_MOODLE}']) maskedVariables['{USUARIO_MOODLE}'] = '••••••';
    if (maskedVariables['{CLAVE_MOODLE}']) maskedVariables['{CLAVE_MOODLE}'] = '••••••';
    const preview = this.ensureUnsubscribeUrl(this.applyVariables(rawMessage, maskedVariables));

    // Aviso, no bloqueo (a diferencia de sendSms/sendSmsFromTemplate): aquí solo
    // se informa para que el aviso aparezca ya en la vista previa, antes de
    // intentar enviar.
    const missingVariables = this.findMissingVariables(rawMessage, variables, !!options.userId);

    return { ...estimateSmsLength(finalMessage), limitParts: this.MAX_SMS_PARTS, preview, missingVariables };
  }

  /**
   * Comprobación previa completa: para cada destinatario de una lista (no
   * solo el primero, a diferencia de `previewLength`), si su SMS ya resuelto
   * tendría alguna variable sin valor o superaría el límite de longitud —
   * sin enviar nada. Pensado para que `SendSmsToGroupModal` avise de antemano
   * de quién tiene un problema (nombre + motivo) antes de lanzar el envío
   * masivo, en vez de descubrirlo por el recuento de "Fallidos" al terminar.
   * Una sola consulta de cuentas de Moodle para todos los `userIds`, no una
   * por destinatario.
   */
  async previewBatch(options: PreviewSmsBatchOptions): Promise<SmsBatchPreviewResult[]> {
    const rawMessage = await this.resolveRawMessage(options);
    const userIds = Array.from(new Set(options.userIds));
    const allMoodleUsers = userIds.length ? await this.moodleUserRepository.findByUserIds(userIds) : [];
    const moodleUsersByUser = new Map<number, typeof allMoodleUsers>();
    for (const mu of allMoodleUsers) {
      const list = moodleUsersByUser.get(mu.id_user) ?? [];
      list.push(mu);
      moodleUsersByUser.set(mu.id_user, list);
    }

    return userIds.map((userId) => {
      const variables = this.buildVariablesFromMoodleUsers(
        options.courseName,
        options.courseStart,
        options.courseEnd,
        options.courseShortName,
        moodleUsersByUser.get(userId) ?? [],
      );
      const missingVariables = this.findMissingVariables(rawMessage, variables, true);
      const finalMessage = this.ensureUnsubscribeUrl(this.applyVariables(rawMessage, variables));
      const info = estimateSmsLength(finalMessage);
      return { userId, missingVariables, length: info.length, parts: info.parts, exceedsLimit: info.parts > this.MAX_SMS_PARTS };
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
