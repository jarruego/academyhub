import { pgTable, serial, varchar, boolean, text } from 'drizzle-orm/pg-core';
import { TIMESTAMPS } from './timestamps';

export const mailTemplatesTable = pgTable('mail_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  content: text('content').notNull(),
  is_html: boolean('is_html').notNull().default(false),
  ...TIMESTAMPS,
});

export type MailTemplate = typeof mailTemplatesTable.$inferSelect;
export type MailTemplateInsert = typeof mailTemplatesTable.$inferInsert;
