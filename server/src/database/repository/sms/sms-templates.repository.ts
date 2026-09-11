import type { SmsTemplate, SmsTemplateInsert } from '../../schema/tables/sms_templates.table';
import { sms_templates } from '../../schema';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database.service';

export class SmsTemplatesRepository {
  constructor(private readonly db: DatabaseService['db']) {}

  async findAll(): Promise<SmsTemplate[]> {
    return this.db.select().from(sms_templates);
  }

  async findById(id: number): Promise<SmsTemplate | null> {
    const rows = await this.db.select().from(sms_templates).where(eq(sms_templates.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(data: SmsTemplateInsert): Promise<SmsTemplate> {
    const [created] = await this.db.insert(sms_templates).values(data).returning();
    return created;
  }

  async update(id: number, data: Partial<SmsTemplateInsert>): Promise<SmsTemplate | null> {
    const [updated] = await this.db.update(sms_templates).set(data).where(eq(sms_templates.id, id)).returning();
    return updated ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.delete(sms_templates).where(eq(sms_templates.id, id));
    return result.rowCount > 0;
  }
}
