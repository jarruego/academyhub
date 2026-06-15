import { pgTable, varchar, integer, boolean, text } from 'drizzle-orm/pg-core';
import { TIMESTAMPS } from './timestamps';

export const smtpSettingsTable = pgTable('smtp_settings', {
  id: integer('id').primaryKey().notNull().default(1),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  user: varchar('user', { length: 255 }).notNull(),
  // Almacenada cifrada (AES-256-GCM serializado a JSON); `text` para no limitar
  // la longitud del blob cifrado. Retro-compatible con valores en claro legacy.
  password: text('password').notNull(),
  secure: boolean('secure').notNull().default(false), // true = SSL/TLS
  from_email: varchar('from_email', { length: 255 }).notNull(),
  from_name: varchar('from_name', { length: 255 }),
  ...TIMESTAMPS,
});

export type SmtpSettings = typeof smtpSettingsTable.$inferSelect;
export type SmtpSettingsInsert = typeof smtpSettingsTable.$inferInsert;
