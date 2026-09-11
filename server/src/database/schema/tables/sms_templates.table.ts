import { serial, varchar, text } from 'drizzle-orm/pg-core';
import { academyhubSchema } from "../pg-schema";
import { TIMESTAMPS } from './timestamps';

export const smsTemplatesTable = academyhubSchema.table('sms_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  message: text('message').notNull(),
  ...TIMESTAMPS,
});

export type SmsTemplate = typeof smsTemplatesTable.$inferSelect;
export type SmsTemplateInsert = typeof smsTemplatesTable.$inferInsert;
