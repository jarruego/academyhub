import { varchar, integer, text } from 'drizzle-orm/pg-core';
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from './timestamps';

export const smsSettingsTable = academyhubSchema.table('sms_settings', {
  id: integer('id').primaryKey().notNull().default(1),
  // Subdominio de la cuenta Mailrelay, sin protocolo (ej. "mecohisa1.ipzmarketing.com").
  // La base URL real se construye como https://{account_url}/api/v1.
  account_url: varchar('account_url', { length: 255 }).notNull(),
  // Almacenada cifrada (AES-256-GCM serializado a JSON), mismo patrón que smtp_settings.password.
  api_key: text('api_key').notNull(),
  // Remitente ("sender_name") por defecto, editable en cada envío.
  sender_name: varchar('sender_name', { length: 20 }).notNull(),
  ...TIMESTAMPS,
});

export type SmsSettings = typeof smsSettingsTable.$inferSelect;
export type SmsSettingsInsert = typeof smsSettingsTable.$inferInsert;
