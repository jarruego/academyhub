import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { audit_log, email_log } from 'src/database/schema';
import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  method?: string;
  actor?: string;
  from?: string;
  to?: string;
}

export interface EmailLogQuery {
  page?: number;
  limit?: number;
  status?: string;
  actor?: string;
  recipient?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  /** Devuelve el registro de auditoría paginado y filtrado (solo lectura). */
  async getAuditLog(q: AuditLogQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const offset = (page - 1) * limit;

    const where: SQL[] = [];
    if (q.method) where.push(eq(audit_log.method, String(q.method).toUpperCase()));
    if (q.actor) where.push(ilike(audit_log.actor_username, `%${q.actor}%`));
    const from = this.parseDate(q.from);
    const to = this.parseDate(q.to);
    if (from) where.push(gte(audit_log.created_at, from));
    if (to) where.push(lte(audit_log.created_at, to));
    const whereCond = where.length ? and(...where) : undefined;

    const db = this.databaseService.db;

    const totalResult = await db.select({ total: count() }).from(audit_log).where(whereCond);
    const total = Number(totalResult?.[0]?.total ?? 0);

    const data = await db
      .select()
      .from(audit_log)
      .where(whereCond)
      .orderBy(desc(audit_log.created_at))
      .limit(limit)
      .offset(offset);

    return { data, total, page, limit };
  }

  /** Devuelve el registro de envíos de correo paginado y filtrado (solo lectura). */
  async getEmailLog(q: EmailLogQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const offset = (page - 1) * limit;

    const where: SQL[] = [];
    if (q.status) where.push(eq(email_log.status, String(q.status).toLowerCase()));
    if (q.actor) where.push(ilike(email_log.actor_username, `%${q.actor}%`));
    if (q.recipient) where.push(ilike(email_log.recipient, `%${q.recipient}%`));
    const whereCond = where.length ? and(...where) : undefined;

    const db = this.databaseService.db;

    const totalResult = await db.select({ total: count() }).from(email_log).where(whereCond);
    const total = Number(totalResult?.[0]?.total ?? 0);

    const data = await db
      .select()
      .from(email_log)
      .where(whereCond)
      .orderBy(desc(email_log.created_at))
      .limit(limit)
      .offset(offset);

    return { data, total, page, limit };
  }
}
