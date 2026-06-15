import { pgTable, serial, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Tabla de respaldo para filas de importación SAGE que no se pudieron procesar.
// Históricamente se creaba con DDL en tiempo de ejecución dentro del bucle de
// importación; ahora está versionada en migraciones. Las columnas deben coincidir
// EXACTAMENTE con ese DDL legacy para que `CREATE TABLE IF NOT EXISTS` sea un no-op
// en bases donde la tabla ya existe.
export const failedUserImportsTable = pgTable('failed_user_imports', {
    id: serial('id').primaryKey(),
    dni: varchar('dni', { length: 20 }),
    name: varchar('name', { length: 100 }),
    first_surname: varchar('first_surname', { length: 100 }),
    second_surname: varchar('second_surname', { length: 100 }),
    email: varchar('email', { length: 255 }),
    import_id: varchar('import_id', { length: 50 }),
    nss: varchar('nss', { length: 20 }),
    company_name: varchar('company_name', { length: 255 }),
    center_name: varchar('center_name', { length: 255 }),
    csv_row_data: jsonb('csv_row_data').notNull(),
    failure_reason: text('failure_reason'),
    import_source: varchar('import_source', { length: 50 }).default('sage'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type FailedUserImportSelectModel = InferSelectModel<typeof failedUserImportsTable>;
export type FailedUserImportInsertModel = InferInsertModel<typeof failedUserImportsTable>;
