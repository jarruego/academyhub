
import { pgTable, serial, varchar, integer } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { companyTable } from "./company.table";

export const centerTable = pgTable('centers', {
    id_center: serial().primaryKey(),
    center_name: varchar({length: 128}).notNull(),
    employer_number: varchar({length: 128}).notNull(),
    id_company: integer().notNull().references(() => companyTable.id_company),
    contact_person: varchar({length: 64}).notNull(),
    contact_phone: varchar({length: 32}).notNull(),
    contact_email: varchar({length: 128}).notNull(),
    ...TIMESTAMPS,
});