import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { OrganizationRepository } from 'src/database/repository/organization/organization.repository';
import { centerTable } from 'src/database/schema/tables/center.table';
import { UpdateOrganizationSettingsDTO } from 'src/dto/organization/update-organization.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

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
      const { encrypted_secrets, ...rest } = row as any;
      return rest;
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

      await this.organizationRepository.upsertForCenter(centerId, { settings: payload.settings, encrypted_secrets: payload.encrypted_secrets } as any, { transaction });

      // Return the fresh row (without encrypted_secrets)
      const fresh = await this.organizationRepository.findByCenterId(centerId, { transaction });
      if (!fresh) return null;
      // strip encrypted_secrets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted_secrets, ...rest } = fresh as any;
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
      const { encrypted_secrets, ...rest } = refreshed as any;
      return rest;
    });
  }
}
