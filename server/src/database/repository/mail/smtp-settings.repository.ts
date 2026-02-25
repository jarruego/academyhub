import { eq } from 'drizzle-orm';
import { smtp_settings } from '../../schema';
import type { SmtpSettings, SmtpSettingsInsert } from '../../schema/tables/smtp_settings.table';
import { DatabaseService } from '../../database.service';

export class SmtpSettingsRepository {
  constructor(private readonly db: DatabaseService['db']) {}

  async getSettings(): Promise<SmtpSettings | null> {
    const rows = await this.db.select().from(smtp_settings).limit(1);
    return rows[0] ?? null;
  }

  async saveSettings(data: SmtpSettingsInsert): Promise<SmtpSettings> {
    const existing = await this.getSettings();
    if (existing) {
      await this.db.update(smtp_settings).set(data).where(eq(smtp_settings.id, 1));
      return { ...existing, ...data } as SmtpSettings;
    } else {
      await this.db.insert(smtp_settings).values({ ...data, id: 1 } as SmtpSettingsInsert);
      return { ...data, id: 1 } as SmtpSettings;
    }
  }
}
