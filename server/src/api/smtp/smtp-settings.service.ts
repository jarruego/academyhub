import { Injectable, Inject } from '@nestjs/common';
import { smtp_settings } from '../../database/schema';
import { eq } from 'drizzle-orm';
import type { SmtpSettings, SmtpSettingsInsert } from '../../database/schema/tables/smtp_settings.table';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class SmtpSettingsService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {}

  async getSettings(): Promise<SmtpSettings | null> {
    console.log('[SMTP] getSettings called');
    const rows = await this.databaseService.db.select().from(smtp_settings).limit(1);
    console.log('[SMTP] getSettings result:', rows);
    return rows[0] ?? null;
  }

  async saveSettings(data: SmtpSettingsInsert): Promise<SmtpSettings> {
    // Only one row (id=1) is allowed
    console.log('[SMTP] saveSettings called with:', data);
    const existing = await this.getSettings();
    if (existing) {
      console.log('[SMTP] saveSettings updating existing row');
      await this.databaseService.db.update(smtp_settings).set(data).where(eq(smtp_settings.id, 1));
      return { ...existing, ...data } as SmtpSettings;
    } else {
      console.log('[SMTP] saveSettings inserting new row');
      await this.databaseService.db.insert(smtp_settings).values({ ...data, id: 1 } as SmtpSettingsInsert);
      return { ...data, id: 1 } as SmtpSettings;
    }
  }
}
