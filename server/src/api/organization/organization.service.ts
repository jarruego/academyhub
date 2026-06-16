import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { tryEncryptSecret } from 'src/utils/crypto/secrets.util';
import { DatabaseService } from 'src/database/database.service';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { centerTable } from 'src/database/schema/tables/center.table';
import { UpdateOrganizationSettingsDTO } from 'src/dto/organization/update-organization.dto';
import { OrganizationSettingsSelectModel, OrganizationSettingsInsertModel } from 'src/database/schema/tables/organization_settings.table';

type CompanyFields = {
  cif?: string | null;
  razon_social?: string | null;
  direccion?: string | null;
  responsable_nombre?: string | null;
  responsable_dni?: string | null;
  ciudad?: string | null;
};

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  // Defaults used when DB `settings` is empty
  private readonly DEFAULT_SETTINGS = {
    site_name: 'Mi Centro',
    contact: { name: 'Contacto', email: 'contacto@centro.test', phone: '' },
    company: {
      cif: '',
      razon_social: '',
      direccion: '',
      ciudad: '',
      responsable_nombre: '',
      responsable_dni: '',
    },
    moodle: { url: '' },
    file_transfer: {
      type: 'ftp',
      host: '',
      port: 21,
      user: '',
      password: '',
      path: '',
    },
    plugins: {
      itop_training: false,
      configurable_reports: false,
      certificates: false,
      progress_bar: false,
    },
  } as const;

  // Rutas dentro de `settings` (JSONB) que contienen secretos y NO deben
  // exponerse al cliente. Cada entrada es [contenedor, campo].
  private static readonly SETTINGS_SECRET_PATHS: ReadonlyArray<[string, string]> = [
    ['file_transfer', 'password'],
    ['sftp', 'password'],
  ];

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Devuelve una copia de `settings` con los secretos (contraseñas de
   * transferencia de archivos) redactados a cadena vacía. No muta el original.
   * El cliente nunca debe recibir estas contraseñas; al guardar, si llegan
   * vacías se preservan las existentes (ver `preserveSecretSettings`).
   */
  private redactSecretSettings(settings: unknown): unknown {
    if (!settings || typeof settings !== 'object') return settings;
    // Clonado profundo simple (settings es JSON serializable)
    const clone = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
    for (const [container, field] of OrganizationService.SETTINGS_SECRET_PATHS) {
      const obj = clone[container];
      if (obj && typeof obj === 'object' && field in (obj as Record<string, unknown>)) {
        const val = (obj as Record<string, unknown>)[field];
        if (typeof val === 'string' && val.length > 0) {
          (obj as Record<string, unknown>)[field] = '';
        }
      }
    }
    return clone;
  }

  /**
   * Antes de persistir: si una contraseña de secreto llega vacía/ausente en el
   * payload pero existe en la BD, se restaura la existente. Evita que el editor
   * JSON (que reenvía `settings` completo con la contraseña redactada) borre las
   * credenciales reales. No muta los argumentos.
   */
  private preserveSecretSettings(incoming: unknown, existing: unknown): unknown {
    if (!incoming || typeof incoming !== 'object') return incoming;
    const result = JSON.parse(JSON.stringify(incoming)) as Record<string, unknown>;
    const prev = (existing && typeof existing === 'object') ? existing as Record<string, unknown> : {};
    for (const [container, field] of OrganizationService.SETTINGS_SECRET_PATHS) {
      const obj = result[container];
      // Solo actuamos si el contenedor sigue presente en el payload (si el admin
      // lo elimina por completo, respetamos esa intención).
      if (!obj || typeof obj !== 'object') continue;
      const incomingVal = (obj as Record<string, unknown>)[field];
      const isEmpty = incomingVal === undefined || incomingVal === null || incomingVal === '';
      if (!isEmpty) continue;
      const prevContainer = prev[container];
      const prevVal = (prevContainer && typeof prevContainer === 'object')
        ? (prevContainer as Record<string, unknown>)[field]
        : undefined;
      if (typeof prevVal === 'string' && prevVal.length > 0) {
        (obj as Record<string, unknown>)[field] = prevVal;
      }
    }
    return result;
  }

  /** Return organization settings (without encrypted_secrets nor plaintext secrets) or null */
  async getSettings() {
    return await this.databaseService.db.transaction(async transaction => {
      const row = await this.organizationRepository.findFirst({ transaction });
      if (!row) return null;
      // strip encrypted_secrets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted_secrets, ...rest } = row as OrganizationSettingsSelectModel;

      // If settings is empty object or null, provide defaults server-side
      const settings = (rest.settings && typeof rest.settings === 'object' && Object.keys(rest.settings).length > 0)
        ? rest.settings
        : { ...this.DEFAULT_SETTINGS };

      // Redactar secretos (contraseñas FTP/SFTP) antes de devolver al cliente
      return { ...rest, settings: this.redactSecretSettings(settings) };
    });
  }

  /** Upsert settings. Will pick a sensible center_id when none exists (single-center setups) */
  async upsertSettings(payload: UpdateOrganizationSettingsDTO) {
    return await this.databaseService.db.transaction(async transaction => {
      // Try to find an existing settings row
      const existing = await this.organizationRepository.findFirst({ transaction });
      let centerId: number;
      if (existing) {
        centerId = existing.center_id;
      } else {
        // pick first center as fallback for single-center installs
        const centers = await transaction.select().from(centerTable).limit(1);
        centerId = (centers && centers.length) ? (centers[0] as any).id_center : 1;
      }

      // If settings are provided in the payload, validate required company fields and reject if missing or empty
      if (payload.settings !== undefined) {
        try {
          const s = payload.settings ?? {} as Record<string, unknown>;
          const company = ((s as Record<string, unknown>)['company'] ?? null) as CompanyFields | null;
          const missing: string[] = [];

          const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

          if (!company || !isNonEmptyString(company.cif)) missing.push('company.cif');
          if (!company || !isNonEmptyString(company.razon_social)) missing.push('company.razon_social');
          if (!company || !isNonEmptyString(company.direccion)) missing.push('company.direccion');
          if (!company || !isNonEmptyString(company.responsable_nombre)) missing.push('company.responsable_nombre');
          if (!company || !isNonEmptyString(company.responsable_dni)) missing.push('company.responsable_dni');

          if (missing.length > 0) {
            // Reject the request: required fields are missing or empty
            throw new BadRequestException(`Faltan campos obligatorios o están vacíos: ${missing.join(', ')}`);
          }
        } catch (err: unknown) {
          if (err instanceof BadRequestException) throw err;
          this.logger.warn('Error while checking organization settings shape', String(err));
        }
      }

      // If the client submitted plaintext token/url keys (legacy client), encrypt them server-side when possible
      const secretsInput = payload.encrypted_secrets ?? undefined;
      const transformedSecrets = secretsInput ? { ...secretsInput } as Record<string, unknown> : undefined;

      if (transformedSecrets) {
        // Common plain keys the UI or admin might have used
        if ('moodle_token_plain' in transformedSecrets) {
          const raw = transformedSecrets['moodle_token_plain'];
          const enc = tryEncryptSecret(typeof raw === 'string' ? raw : undefined);
          if (enc) {
            transformedSecrets['moodle_token'] = enc;
            delete transformedSecrets['moodle_token_plain'];
            this.logger.log('Encrypted moodle_token_plain before storing');
          } else {
            this.logger.warn('APP_MASTER_KEY not set; storing moodle_token_plain as plaintext');
          }
        }
        if ('moodle_url_plain' in transformedSecrets) {
          const raw = transformedSecrets['moodle_url_plain'];
          const enc = tryEncryptSecret(typeof raw === 'string' ? raw : undefined);
          if (enc) {
            transformedSecrets['moodle_url'] = enc;
            delete transformedSecrets['moodle_url_plain'];
            this.logger.log('Encrypted moodle_url_plain before storing');
          } else {
            this.logger.warn('APP_MASTER_KEY not set; storing moodle_url_plain as plaintext');
          }
        }
      }

      // Preservar contraseñas de secretos: si el payload las trae vacías
      // (porque el cliente recibió la versión redactada), se reinyectan las
      // existentes para no borrar credenciales reales al guardar.
      const settingsToPersist = payload.settings !== undefined
        ? this.preserveSecretSettings(payload.settings, existing?.settings)
        : undefined;

      const upsertPayload: Partial<OrganizationSettingsInsertModel> = {
        settings: settingsToPersist as OrganizationSettingsInsertModel['settings'] ?? undefined,
        encrypted_secrets: transformedSecrets as OrganizationSettingsInsertModel['encrypted_secrets'] ?? undefined,
      };

      await this.organizationRepository.upsertForCenter(centerId, upsertPayload, { transaction });

      // Return the fresh row (without encrypted_secrets)
      const fresh = await this.organizationRepository.findByCenterId(centerId, { transaction });
      if (!fresh) return null;
      // strip encrypted_secrets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted_secrets, ...rest } = fresh as OrganizationSettingsSelectModel;
      // Redactar secretos también en la respuesta del guardado
      return { ...rest, settings: this.redactSecretSettings(rest.settings) };
    });
  }

  async setAssetPath(id: number, type: 'logo' | 'signature', pathValue: string) {
    return await this.databaseService.db.transaction(async transaction => {
      // update and then return the row (repository methods update only)
      await this.organizationRepository.setAssetPathById(id, type === 'logo' ? 'logo_path' : 'signature_path', pathValue, { transaction });
      // simple re-query
      const refreshed = await this.organizationRepository.findFirst({ transaction });
      if (!refreshed) return null;
      // strip encrypted_secrets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted_secrets, ...rest } = refreshed as OrganizationSettingsSelectModel;
      return { ...rest, settings: this.redactSecretSettings(rest.settings) };
    });
  }
}
