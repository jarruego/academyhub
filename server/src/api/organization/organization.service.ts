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
    plugins: {
      itop_training: false,
      configurable_reports: false,
      certificates: false,
      progress_bar: false,
    },
  } as const;

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  /** Return organization settings (without encrypted_secrets) or null */
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

      return { ...rest, settings };
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

      const upsertPayload: Partial<OrganizationSettingsInsertModel> = {
        settings: payload.settings ?? undefined,
        encrypted_secrets: transformedSecrets as OrganizationSettingsInsertModel['encrypted_secrets'] ?? undefined,
      };

      await this.organizationRepository.upsertForCenter(centerId, upsertPayload, { transaction });

      // Return the fresh row (without encrypted_secrets)
      const fresh = await this.organizationRepository.findByCenterId(centerId, { transaction });
      if (!fresh) return null;
      // strip encrypted_secrets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted_secrets, ...rest } = fresh as OrganizationSettingsSelectModel;
      return rest;
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
      return rest;
    });
  }
}
