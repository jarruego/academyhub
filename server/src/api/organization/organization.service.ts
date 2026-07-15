import { Inject, Injectable, Logger } from '@nestjs/common';
import { tryEncryptSecret } from 'src/utils/crypto/secrets.util';
import { DatabaseService } from 'src/database/database.service';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { centerTable } from 'src/database/schema/tables/center.table';
import { UpdateOrganizationSettingsDTO } from 'src/dto/organization/update-organization.dto';
import { OrganizationSettingsSelectModel, OrganizationSettingsInsertModel } from 'src/database/schema/tables/organization_settings.table';
import {
  normalizeOrganizationSettings,
  readLegacyFileTransferPassword,
  OrganizationSettingsData,
  ORG_SECRET_KEYS,
} from './organization-settings.model';

/** Forma que reciben el controlador y el cliente: settings normalizados + flags de secretos (nunca los valores). */
export type OrganizationSettingsResponse = {
  id: number;
  center_id: number;
  settings: OrganizationSettingsData;
  logo_path: string | null;
  signature_path: string | null;
  version: number | null;
  created_at: Date;
  updated_at: Date;
  secrets: {
    has_moodle_token: boolean;
    has_file_transfer_password: boolean;
  };
};

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Convierte una fila de BD a la respuesta pública: settings normalizados
   * (defaults aplicados, sin contraseñas — el modelo tipado no las incluye)
   * y flags de presencia de secretos para la UI.
   */
  private toResponse(row: OrganizationSettingsSelectModel): OrganizationSettingsResponse {
    const secrets = (row.encrypted_secrets ?? {}) as Record<string, unknown>;
    const hasSecret = (key: string) => {
      const v = secrets[key];
      return v !== undefined && v !== null && v !== '';
    };
    // Nota: la fila legacy puede aún tener la contraseña en claro en settings
    // (se migra al primer guardado); el flag la cuenta como presente.
    const legacyPwd = readLegacyFileTransferPassword(row.settings);
    return {
      id: row.id,
      center_id: row.center_id,
      settings: normalizeOrganizationSettings(row.settings),
      logo_path: row.logo_path ?? null,
      signature_path: row.signature_path ?? null,
      version: row.version ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      secrets: {
        has_moodle_token: hasSecret(ORG_SECRET_KEYS.moodleToken) || hasSecret('moodle_token_plain'),
        has_file_transfer_password: hasSecret(ORG_SECRET_KEYS.fileTransferPassword) || legacyPwd !== undefined,
      },
    };
  }

  /** Devuelve los ajustes de la organización (normalizados, sin secretos) o null. */
  async getSettings(): Promise<OrganizationSettingsResponse | null> {
    return await this.databaseService.db.transaction(async transaction => {
      const row = await this.organizationRepository.findFirst({ transaction });
      if (!row) return null;
      return this.toResponse(row);
    });
  }

  /**
   * Ajustes normalizados para consumo interno (Moodle, importador, informes).
   * Devuelve defaults si aún no hay fila guardada.
   */
  async getTypedSettings(): Promise<OrganizationSettingsData> {
    const row = await this.organizationRepository.findFirst();
    return normalizeOrganizationSettings(row?.settings);
  }

  /**
   * Upsert de ajustes. La validación de forma la hace el DTO
   * (`OrganizationSettingsDto` + ValidationPipe global con whitelist).
   *
   * Secretos: `file_transfer.password` nunca se guarda en el JSONB `settings`;
   * si llega en el payload se cifra en `encrypted_secrets.file_transfer_password`
   * (vacía = conservar la existente). Las contraseñas legacy en claro dentro de
   * `settings` se migran a `encrypted_secrets` en el primer guardado.
   * `encrypted_secrets` se fusiona con lo existente (guardar el token de Moodle
   * no borra la contraseña FTP y viceversa).
   */
  async upsertSettings(payload: UpdateOrganizationSettingsDTO): Promise<OrganizationSettingsResponse | null> {
    return await this.databaseService.db.transaction(async transaction => {
      const existing = await this.organizationRepository.findFirst({ transaction });
      let centerId: number;
      if (existing) {
        centerId = existing.center_id;
      } else {
        // pick first center as fallback for single-center installs
        const centers = await transaction.select().from(centerTable).limit(1);
        centerId = (centers && centers.length) ? (centers[0] as any).id_center : 1;
      }

      // Base de secretos: SIEMPRE los existentes (merge, nunca reemplazo total)
      const existingSecrets = (existing?.encrypted_secrets ?? {}) as Record<string, unknown>;
      const mergedSecrets: Record<string, unknown> = { ...existingSecrets };
      let secretsChanged = false;

      // Claves *_plain enviadas por el cliente: se cifran en el servidor
      if (payload.encrypted_secrets) {
        for (const [key, raw] of Object.entries(payload.encrypted_secrets)) {
          if (key === 'moodle_token_plain' || key === 'moodle_url_plain') {
            const targetKey = key === 'moodle_token_plain' ? ORG_SECRET_KEYS.moodleToken : ORG_SECRET_KEYS.moodleUrl;
            const enc = tryEncryptSecret(typeof raw === 'string' ? raw : undefined);
            if (enc) {
              mergedSecrets[targetKey] = enc;
              this.logger.log(`Encrypted ${key} before storing`);
            } else if (typeof raw === 'string' && raw.length > 0) {
              this.logger.warn(`APP_MASTER_KEY not set; storing ${key} as plaintext`);
              mergedSecrets[targetKey] = raw;
            }
          } else {
            mergedSecrets[key] = raw;
          }
          secretsChanged = true;
        }
      }

      // settings.file_transfer.password es write-only: se extrae y cifra
      let settingsToPersist: Record<string, unknown> | undefined;
      if (payload.settings !== undefined) {
        settingsToPersist = JSON.parse(JSON.stringify(payload.settings)) as Record<string, unknown>;
        const fileTransfer = settingsToPersist['file_transfer'];
        if (fileTransfer && typeof fileTransfer === 'object') {
          const ft = fileTransfer as Record<string, unknown>;
          const incomingPwd = ft['password'];
          delete ft['password'];
          if (typeof incomingPwd === 'string' && incomingPwd.length > 0) {
            const enc = tryEncryptSecret(incomingPwd);
            mergedSecrets[ORG_SECRET_KEYS.fileTransferPassword] = enc ?? incomingPwd;
            if (!enc) this.logger.warn('APP_MASTER_KEY not set; storing file_transfer password as plaintext secret');
            secretsChanged = true;
          }
        }

        // Migración perezosa: contraseña legacy en claro dentro del JSONB antiguo
        if (mergedSecrets[ORG_SECRET_KEYS.fileTransferPassword] === undefined) {
          const legacyPwd = readLegacyFileTransferPassword(existing?.settings);
          if (legacyPwd) {
            const enc = tryEncryptSecret(legacyPwd);
            mergedSecrets[ORG_SECRET_KEYS.fileTransferPassword] = enc ?? legacyPwd;
            secretsChanged = true;
            this.logger.log('Migrated legacy plaintext file_transfer password to encrypted_secrets');
          }
        }
      }

      const upsertPayload: Partial<OrganizationSettingsInsertModel> = {
        updated_at: new Date(),
      };
      if (settingsToPersist !== undefined) {
        upsertPayload.settings = settingsToPersist as OrganizationSettingsInsertModel['settings'];
      }
      if (secretsChanged) {
        upsertPayload.encrypted_secrets = mergedSecrets as OrganizationSettingsInsertModel['encrypted_secrets'];
      }

      await this.organizationRepository.upsertForCenter(centerId, upsertPayload, { transaction });

      const fresh = await this.organizationRepository.findByCenterId(centerId, { transaction });
      if (!fresh) return null;
      return this.toResponse(fresh);
    });
  }

  async setAssetPath(id: number, type: 'logo' | 'signature', pathValue: string): Promise<OrganizationSettingsResponse | null> {
    return await this.databaseService.db.transaction(async transaction => {
      await this.organizationRepository.setAssetPathById(id, type === 'logo' ? 'logo_path' : 'signature_path', pathValue, { transaction });
      const refreshed = await this.organizationRepository.findFirst({ transaction });
      if (!refreshed) return null;
      return this.toResponse(refreshed);
    });
  }
}
