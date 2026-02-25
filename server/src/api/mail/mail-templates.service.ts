import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../../database/database.module';
import { DatabaseService } from '../../database/database.service';
import type { MailTemplate, MailTemplateInsert } from '../../database/schema/tables/mail_templates.table';
import { MailTemplatesRepository } from '../../database/repository/mail/mail-templates.repository';

@Injectable()
export class MailTemplatesService {
  private readonly repo: MailTemplatesRepository;

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {
    this.repo = new MailTemplatesRepository(this.databaseService.db);
  }

  findAll(): Promise<MailTemplate[]> {
    return this.repo.findAll();
  }

  findById(id: number): Promise<MailTemplate | null> {
    return this.repo.findById(id);
  }

  create(data: MailTemplateInsert): Promise<MailTemplate> {
    return this.repo.create(data);
  }

  update(id: number, data: Partial<MailTemplateInsert>): Promise<MailTemplate | null> {
    return this.repo.update(id, data);
  }

  delete(id: number): Promise<boolean> {
    return this.repo.delete(id);
  }
}
