import { Injectable } from "@nestjs/common";
import { QueryOptions, Repository } from "../repository";
import {
  OrganizationSettingsInsertModel,
  OrganizationSettingsSelectModel,
  OrganizationSettingsUpdateModel,
  organizationSettingsTable,
} from "src/database/schema/tables/organization_settings.table";
import { eq } from "drizzle-orm";
import { InsertResult } from 'src/database/types/insert-result';

@Injectable()
export class OrganizationRepository extends Repository {
  async findFirst(options?: QueryOptions): Promise<OrganizationSettingsSelectModel | null> {
    const rows = await this.query(options).select().from(organizationSettingsTable).limit(1);
    return rows?.[0] ?? null;
  }

  async findByCenterId(centerId: number, options?: QueryOptions): Promise<OrganizationSettingsSelectModel | null> {
    const rows = await this.query(options).select().from(organizationSettingsTable).where(eq(organizationSettingsTable.center_id, centerId)).limit(1);
    return rows?.[0] ?? null;
  }

  async create(data: OrganizationSettingsInsertModel, options?: QueryOptions): Promise<InsertResult> {
    const result = await this.query(options).insert(organizationSettingsTable).values(data).returning({ insertId: organizationSettingsTable.id });
    return result?.[0] ?? {};
  }

  async updateById(id: number, data: OrganizationSettingsUpdateModel, options?: QueryOptions) {
    const result = await this.query(options).update(organizationSettingsTable).set(data).where(eq(organizationSettingsTable.id, id));
    return result;
  }

  /**
   * Convenience to set asset path (logo/signature) by organization id
   */
  async setAssetPathById(id: number, col: "logo_path" | "signature_path", value: string, options?: QueryOptions) {
    const data: any = {};
    data[col] = value;
    // Use update to set the provided value. Version bump/updated_at can be handled elsewhere if needed.
    const result = await this.query(options).update(organizationSettingsTable).set(data).where(eq(organizationSettingsTable.id, id));
    return result;
  }

  /**
   * If no organization settings exist for the given center, create one. Otherwise update.
   */
  async upsertForCenter(centerId: number, payload: Partial<OrganizationSettingsInsertModel>, options?: QueryOptions) {
    const existing = await this.findByCenterId(centerId, options);
    if (existing) {
      await this.updateById(existing.id, payload as OrganizationSettingsUpdateModel, options);
      return { id: existing.id };
    }
    const created = await this.create({ center_id: centerId, settings: payload.settings ?? {}, logo_path: payload.logo_path ?? null, signature_path: payload.signature_path ?? null, encrypted_secrets: payload.encrypted_secrets ?? null } as OrganizationSettingsInsertModel, options);
    return created;
  }
}
