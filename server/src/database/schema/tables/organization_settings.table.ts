import { pgTable, serial, integer, jsonb, text, integer as intCol, timestamp } from "drizzle-orm/pg-core";
import { centerTable } from "./center.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const organizationSettingsTable = pgTable('organization_settings', {
    id: serial().primaryKey(),
    center_id: integer().notNull().references(() => centerTable.id_center),
    settings: jsonb().notNull(),
    logo_path: text(),
    signature_path: text(),
    encrypted_secrets: jsonb(),
    version: intCol().default(1),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

export type OrganizationSettingsSelectModel = InferSelectModel<typeof organizationSettingsTable>;
export type OrganizationSettingsInsertModel = InferInsertModel<typeof organizationSettingsTable>;
export type OrganizationSettingsUpdateModel = Partial<OrganizationSettingsInsertModel>;
