import { pgTable, serial, integer, jsonb, text, integer as intCol, timestamp } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const organizationSettingsTable = pgTable('organization_settings', {
    id: serial().primaryKey(),
    // Note: center_id is intentionally NOT declared as a foreign key reference.
    // It represents the id of the center the organization settings relate to
    // but is left unreferenced so it can remain flexible for future features
    // (e.g. per-center settings) without enforcing DB-level FK constraints.
    center_id: integer().notNull(),
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
