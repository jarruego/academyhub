import { pgTable, serial, varchar, integer, index } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { companyTable } from "./company.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const centerTable = pgTable('centers', {
    id_center: serial().primaryKey(),
    center_name: varchar({length: 128}).notNull(),
    employer_number: varchar({length: 128}),
    id_company: integer().notNull().references(() => companyTable.id_company),
    contact_person: varchar({length: 64}),
    contact_phone: varchar({length: 32}),
    contact_email: varchar({length: 128}),
    import_id: varchar({length: 128}),
    // ...TIMESTAMPS,
}, (table) => {
    return {
        // import_id: matching exacto y prefix (LIKE) en cada fila de importación
        importIdIdx: index("idx_centers_import_id").on(table.import_id),
        // id_company: FK usada en joins de reports y búsquedas de centros por empresa
        companyIdx: index("idx_centers_id_company").on(table.id_company),
    };
});

export type CenterSelectModel = InferSelectModel<typeof centerTable> & {company_name?: string; user_count?: number; main_user_count?: number};
export type CenterInsertModel = InferInsertModel<typeof centerTable>;
export type CenterUpdateModel = Partial<CenterInsertModel>;
