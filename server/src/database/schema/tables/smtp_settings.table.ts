import { pgTable, varchar, integer, boolean } from 'drizzle-orm/pg-core';
import { TIMESTAMPS } from './timestamps';

export const smtpSettingsTable = pgTable('smtp_settings', {
  id: integer('id').primaryKey().notNull().default(1),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  user: varchar('user', { length: 255 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  secure: boolean('secure').notNull().default(false), // true = SSL/TLS
  from_email: varchar('from_email', { length: 255 }).notNull(),
  from_name: varchar('from_name', { length: 255 }),
  ...TIMESTAMPS,
});

export type SmtpSettings = typeof smtpSettingsTable.$inferSelect;
export type SmtpSettingsInsert = typeof smtpSettingsTable.$inferInsert;
