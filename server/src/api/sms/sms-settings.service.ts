import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { SmsSettings, SmsSettingsInsert } from '../../database/schema/tables/sms_settings.table';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { SmsSettingsRepository } from '../../database/repository/sms/sms-settings.repository';
import { encryptSecretToString, decryptSecretFromString } from '../../utils/crypto/secrets.util';

// La api_key entrante puede venir vacía/ausente (señal de "mantener la actual").
type SaveSmsInput = Omit<SmsSettingsInsert, 'api_key'> & { api_key?: string | null };

@Injectable()
export class SmsSettingsService {
  private readonly repo: SmsSettingsRepository;

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {
    this.repo = new SmsSettingsRepository(this.databaseService.db);
  }

  /**
   * Devuelve los ajustes SMS con la api_key DESCIFRADA. Uso interno
   * (SmsService/MailrelaySmsClient la necesitan en claro). El controlador la
   * enmascara antes de enviarla al cliente.
   */
  async getSettings(): Promise<SmsSettings | null> {
    const row = await this.repo.getSettings();
    if (!row) return null;
    return { ...row, api_key: decryptSecretFromString(row.api_key) ?? '' } as SmsSettings;
  }

  /**
   * Guarda los ajustes SMS. La api_key se almacena cifrada. Si llega
   * vacía/ausente, se preserva la ya almacenada (no se pierde la credencial).
   * Devuelve la fila guardada con la api_key descifrada (el controlador la
   * enmascara antes de responder al cliente).
   */
  async saveSettings(data: SaveSmsInput): Promise<SmsSettings> {
    const existing = await this.repo.getSettings();

    const incoming = data.api_key;
    const isEmpty = incoming === undefined || incoming === null || incoming === '';

    let apiKeyToStore: string;
    if (isEmpty) {
      if (!existing?.api_key) {
        throw new BadRequestException('La API key de Mailrelay es obligatoria al configurar el SMS por primera vez');
      }
      apiKeyToStore = existing.api_key;
    } else {
      apiKeyToStore = encryptSecretToString(incoming) as string;
    }

    const saved = await this.repo.saveSettings({ ...data, api_key: apiKeyToStore } as SmsSettingsInsert);
    return { ...saved, api_key: decryptSecretFromString(saved.api_key) ?? '' } as SmsSettings;
  }
}
