import { pgTable, varchar, serial } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { InferSelectModel } from "drizzle-orm";

export const companyTable = pgTable('companies', {
    id_company: serial().primaryKey(),
    company_name: varchar({length: 128}).notNull(),
    corporate_name: varchar({length: 256}).notNull(),
    cif: varchar({length: 12}).notNull().unique(),
    //...TIMESTAMPS,
});

export type CompanySelectModel = Partial<InferSelectModel<typeof companyTable>>;
export type CompanyInsertModel = Omit<InferSelectModel<typeof companyTable>, 'id_company'>;
export type CompanyUpdateModel = Partial<InferSelectModel<typeof companyTable>>;