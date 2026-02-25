import { Injectable, Inject } from '@nestjs/common';
import type { SmtpSettings, SmtpSettingsInsert } from '../../database/schema/tables/smtp_settings.table';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import { SmtpSettingsRepository } from '../../database/repository/mail/smtp-settings.repository';

@Injectable()
export class SmtpSettingsService {
  private readonly repo: SmtpSettingsRepository;

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {
    this.repo = new SmtpSettingsRepository(this.databaseService.db);
  }

  async getSettings(): Promise<SmtpSettings | null> {
    return this.repo.getSettings();
  }

  async saveSettings(data: SmtpSettingsInsert): Promise<SmtpSettings> {
    return this.repo.saveSettings(data);
  }
}
