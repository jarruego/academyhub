import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../api/mail/mail.service';
import { AuthUserRepository } from '../database/repository/auth/auth_user.repository';
import { Role } from '../guards/role.enum';

/** Escapa los caracteres HTML mínimos para incrustar texto en el cuerpo del correo. */
function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface JobFailureNotification {
  /** Nombre legible del proceso que falló, p.ej. "Importación SAGE". */
  source: string;
  /** Mensaje de error principal. */
  error: string;
  /** Identificador del job, si aplica. */
  jobId?: string;
  /** Detalles adicionales (líneas separadas por \n). */
  details?: string;
}

/**
 * Envía avisos por correo a los administradores cuando una tarea desatendida
 * (importación SAGE, sync de Moodle) falla. Reutiliza el envío SMTP de
 * MailService y obtiene los destinatarios de los auth_users con rol admin.
 *
 * Todos los métodos públicos son best-effort: nunca lanzan, para no afectar
 * al flujo del proceso que los invoca.
 */
@Injectable()
export class AdminNotificationService {
  private readonly logger = new Logger(AdminNotificationService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly authUserRepository: AuthUserRepository,
  ) {}

  /** Correos (no vacíos) de todos los auth_users con rol administrador. */
  private async getAdminEmails(): Promise<string[]> {
    const admins = await this.authUserRepository.findAll({ role: Role.ADMIN });
    return admins
      .map((a) => (a.email || '').trim())
      .filter((email) => email.length > 0);
  }

  /** Fecha/hora actual formateada en la zona horaria del scheduler. */
  private nowFormatted(): string {
    const tz = process.env.SCHEDULER_TIMEZONE || 'UTC';
    try {
      return new Date().toLocaleString('es-ES', { timeZone: tz });
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Notifica a todos los administradores el fallo de una tarea programada.
   * Best-effort: captura cualquier error (incluida la falta de SMTP) y solo lo
   * registra en el log; nunca propaga la excepción.
   */
  async notifyScheduledJobFailure(params: JobFailureNotification): Promise<void> {
    try {
      const emails = await this.getAdminEmails();
      if (emails.length === 0) {
        this.logger.warn(
          `No hay administradores con correo para notificar el fallo de "${params.source}".`,
        );
        return;
      }

      const subject = `⚠️ Fallo en ${params.source} — AcademyHub`;
      const parts = [
        `<p>Se ha producido un fallo en <strong>${escapeHtml(params.source)}</strong>.</p>`,
        `<p><strong>Fecha:</strong> ${escapeHtml(this.nowFormatted())}</p>`,
        params.jobId ? `<p><strong>Job:</strong> ${escapeHtml(params.jobId)}</p>` : '',
        `<p><strong>Error:</strong> ${escapeHtml(params.error)}</p>`,
        params.details
          ? `<p><strong>Detalles:</strong><br>${escapeHtml(params.details).replace(/\n/g, '<br>')}</p>`
          : '',
        `<hr><p style="color:#888;font-size:12px">Mensaje automático del sistema AcademyHub.</p>`,
      ].filter(Boolean);

      await this.mailService.sendMail({
        to: emails,
        subject,
        html: parts.join('\n'),
        actor: { username: 'system', role: 'system' },
      });

      this.logger.log(
        `Notificación de fallo de "${params.source}" enviada a ${emails.length} administrador(es).`,
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo notificar el fallo de "${params.source}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
