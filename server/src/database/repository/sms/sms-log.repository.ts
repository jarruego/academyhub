import { and, count, desc, eq, ilike } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { sms_log } from '../../schema';
import type { SmsLogInsertModel, SmsLogSelectModel } from '../../schema/tables/sms_log.table';
import { DatabaseService } from '../../database.service';

export interface SmsLogQuery {
  page?: number;
  limit?: number;
  status?: string;
  actor?: string;
  recipient?: string;
}

export class SmsLogRepository {
  constructor(private readonly db: DatabaseService['db']) {}

  async create(data: SmsLogInsertModel): Promise<SmsLogSelectModel> {
    const [created] = await this.db.insert(sms_log).values(data).returning();
    return created;
  }

  async findById(id: number): Promise<SmsLogSelectModel | null> {
    const rows = await this.db.select().from(sms_log).where(eq(sms_log.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async update(id: number, data: Partial<SmsLogInsertModel>): Promise<SmsLogSelectModel | null> {
    const [updated] = await this.db.update(sms_log).set(data).where(eq(sms_log.id, id)).returning();
    return updated ?? null;
  }

  async list(q: SmsLogQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const offset = (page - 1) * limit;

    const where: SQL[] = [];
    if (q.status) where.push(eq(sms_log.status, String(q.status).toLowerCase()));
    if (q.actor) where.push(ilike(sms_log.actor_username, `%${q.actor}%`));
    if (q.recipient) where.push(ilike(sms_log.recipient, `%${q.recipient}%`));
    const whereCond = where.length ? and(...where) : undefined;

    const totalResult = await this.db.select({ total: count() }).from(sms_log).where(whereCond);
    const total = Number(totalResult?.[0]?.total ?? 0);

    const data = await this.db
      .select()
      .from(sms_log)
      .where(whereCond)
      .orderBy(desc(sms_log.created_at))
      .limit(limit)
      .offset(offset);

    return { data, total, page, limit };
  }
}
