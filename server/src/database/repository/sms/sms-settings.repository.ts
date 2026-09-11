import { eq } from 'drizzle-orm';
import { sms_settings } from '../../schema';
import type { SmsSettings, SmsSettingsInsert } from '../../schema/tables/sms_settings.table';
import { DatabaseService } from '../../database.service';

export class SmsSettingsRepository {
  constructor(private readonly db: DatabaseService['db']) {}

  async getSettings(): Promise<SmsSettings | null> {
    const rows = await this.db.select().from(sms_settings).limit(1);
    return rows[0] ?? null;
  }

  async saveSettings(data: SmsSettingsInsert): Promise<SmsSettings> {
    const existing = await this.getSettings();
    if (existing) {
      await this.db.update(sms_settings).set(data).where(eq(sms_settings.id, 1));
      return { ...existing, ...data } as SmsSettings;
    } else {
      await this.db.insert(sms_settings).values({ ...data, id: 1 } as SmsSettingsInsert);
      return { ...data, id: 1 } as SmsSettings;
    }
  }
}
