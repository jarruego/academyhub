import type { MailTemplate, MailTemplateInsert } from '../../schema/tables/mail_templates.table';
import { mail_templates } from '../../schema';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database.service';

export class MailTemplatesRepository {
  constructor(private readonly db: DatabaseService['db']) {}

  async findAll(): Promise<MailTemplate[]> {
    return this.db.select().from(mail_templates);
  }

  async findById(id: number): Promise<MailTemplate | null> {
    const rows = await this.db.select().from(mail_templates).where(eq(mail_templates.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(data: MailTemplateInsert): Promise<MailTemplate> {
    const [created] = await this.db.insert(mail_templates).values(data).returning();
    return created;
  }

  async update(id: number, data: Partial<MailTemplateInsert>): Promise<MailTemplate | null> {
    const [updated] = await this.db.update(mail_templates).set(data).where(eq(mail_templates.id, id)).returning();
    return updated ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.delete(mail_templates).where(eq(mail_templates.id, id));
    return result.rowCount > 0;
  }
}
