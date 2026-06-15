import { pgTable, varchar, serial, index } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const companyTable = pgTable('companies', {
    id_company: serial().primaryKey(),
    company_name: varchar({length: 128}).notNull(),
    corporate_name: varchar({length: 256}).notNull(),
    cif: varchar({length: 12}).notNull().unique(),
    import_id: varchar({length: 128}),
    //...TIMESTAMPS,
}, (table) => {
    return {
        // import_id se consulta durante el matching de importación SAGE
        importIdIdx: index("idx_companies_import_id").on(table.import_id),
    };
});

export type CompanySelectModel = InferSelectModel<typeof companyTable>;
export type CompanyInsertModel = InferInsertModel<typeof companyTable>;
export type CompanyUpdateModel = Partial<CompanyInsertModel>;

