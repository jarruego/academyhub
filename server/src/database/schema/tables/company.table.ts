import { pgTable, varchar, serial } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";

export const companyTable = pgTable('companies', {
    id_company: serial().primaryKey(),
    company_name: varchar({length: 128}).notNull(),
    corporate_name: varchar({length: 256}).notNull(),
    cif: varchar({length: 12}).notNull().unique(),
    ...TIMESTAMPS,
});