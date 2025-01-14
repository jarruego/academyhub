
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";

export const companyTable = pgTable('companies', {
    id_company: serial().primaryKey(),
    company_name: text().notNull(),
    corporate_name: text().notNull(),
    cif: text().notNull().unique(),
    ...TIMESTAMPS,
});