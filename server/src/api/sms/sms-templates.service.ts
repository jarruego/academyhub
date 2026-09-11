import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import type { SmsTemplate, SmsTemplateInsert } from '../../database/schema/tables/sms_templates.table';
import { SmsTemplatesRepository } from '../../database/repository/sms/sms-templates.repository';

@Injectable()
export class SmsTemplatesService {
  private readonly repo: SmsTemplatesRepository;

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {
    this.repo = new SmsTemplatesRepository(this.databaseService.db);
  }

  findAll(): Promise<SmsTemplate[]> {
    return this.repo.findAll();
  }

  findById(id: number): Promise<SmsTemplate | null> {
    return this.repo.findById(id);
  }

  create(data: SmsTemplateInsert): Promise<SmsTemplate> {
    return this.repo.create(data);
  }

  update(id: number, data: Partial<SmsTemplateInsert>): Promise<SmsTemplate | null> {
    return this.repo.update(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.repo.delete(id);
  }
}
