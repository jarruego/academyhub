import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Tabla para locks distribuidos del scheduler
export const schedulerLockTable = pgTable(
    'scheduler_locks',
    {
        lock_key: varchar('lock_key', { length: 255 }).primaryKey(),
        acquired_at: timestamp('acquired_at', { withTimezone: true }).defaultNow(),
        expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
        created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => ({
        expiresAtIdx: index('idx_scheduler_locks_expires_at').on(table.expires_at),
    })
);

export type SchedulerLock = InferSelectModel<typeof schedulerLockTable>;
export type NewSchedulerLock = InferInsertModel<typeof schedulerLockTable>;
