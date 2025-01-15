
import { pgTable, serial, text, bigint } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { companyTable } from "./company.table";

export const centerTable = pgTable('centers', {
    id_center: serial().primaryKey(),
    center_name: text().notNull(),
    employer_number: text().notNull(),
    id_company: bigint({ mode: 'number' }).references(() => companyTable.id_company).notNull(),
    contact_person: text().notNull(),
    contact_phone: text().notNull(),
    contact_email: text().notNull(),
    ...TIMESTAMPS,
});