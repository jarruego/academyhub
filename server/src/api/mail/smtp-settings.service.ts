import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { SmtpSettings, SmtpSettingsInsert } from '../../database/schema/tables/smtp_settings.table';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { SmtpSettingsRepository } from '../../database/repository/mail/smtp-settings.repository';
import { encryptSecretToString, decryptSecretFromString } from '../../utils/crypto/secrets.util';

// La contraseña entrante puede venir vacía/ausente (señal de "mantener la actual").
type SaveSmtpInput = Omit<SmtpSettingsInsert, 'password'> & { password?: string | null };

@Injectable()
export class SmtpSettingsService {
  private readonly repo: SmtpSettingsRepository;

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {
    this.repo = new SmtpSettingsRepository(this.databaseService.db);
  }

  /**
   * Devuelve los ajustes SMTP con la contraseña DESCIFRADA. Uso interno
   * (MailService la necesita en claro para autenticar con nodemailer).
   * El controlador la enmascara antes de enviarla al cliente.
   */
  async getSettings(): Promise<SmtpSettings | null> {
    const row = await this.repo.getSettings();
    if (!row) return null;
    return { ...row, password: decryptSecretFromString(row.password) ?? '' } as SmtpSettings;
  }

  /**
   * Guarda los ajustes SMTP. La contraseña se almacena cifrada. Si llega
   * vacía/ausente, se preserva la ya almacenada (no se pierde la credencial).
   * Devuelve la fila guardada con la contraseña descifrada (el controlador la
   * enmascara antes de responder al cliente).
   */
  async saveSettings(data: SaveSmtpInput): Promise<SmtpSettings> {
    const existing = await this.repo.getSettings();

    const incoming = data.password;
    const isEmpty = incoming === undefined || incoming === null || incoming === '';

    let passwordToStore: string;
    if (isEmpty) {
      // Preservar la contraseña existente (ya está en su forma almacenada).
      if (!existing?.password) {
        throw new BadRequestException('La contraseña SMTP es obligatoria al configurar el servidor por primera vez');
      }
      passwordToStore = existing.password;
    } else {
      // Cifrar la nueva contraseña. encryptSecretToString nunca devuelve vacío
      // para una entrada no vacía (devuelve el cifrado o, sin clave, el claro).
      passwordToStore = encryptSecretToString(incoming) as string;
    }

    const saved = await this.repo.saveSettings({ ...data, password: passwordToStore } as SmtpSettingsInsert);
    return { ...saved, password: decryptSecretFromString(saved.password) ?? '' } as SmtpSettings;
  }
}
