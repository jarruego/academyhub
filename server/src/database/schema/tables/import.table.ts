import { pgTable, serial, varchar, numeric, jsonb, boolean, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { userTable } from "./user.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Tabla para gestionar trabajos de importación
export const importJobTable = pgTable('import_jobs', {
    id: serial().primaryKey(),
    job_id: varchar('job_id', { length: 50 }).notNull().unique(),
    import_type: varchar('import_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    total_rows: integer('total_rows').default(0),
    processed_rows: integer('processed_rows').default(0),
    error_message: varchar('error_message', { length: 500 }),
    result_summary: jsonb('result_summary'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
});

// Tabla para decisiones manuales de importación
export const importDecisionsTable = pgTable('import_decisions', {
    id: serial().primaryKey(),
    import_source: varchar('import_source', { length: 50 }).notNull(),
    dni_csv: varchar('dni_csv', { length: 20 }),
    name_csv: varchar('name_csv', { length: 100 }),
    first_surname_csv: varchar('first_surname_csv', { length: 100 }),
    second_surname_csv: varchar('second_surname_csv', { length: 100 }),
    name_db: varchar('name_db', { length: 100 }),
    first_surname_db: varchar('first_surname_db', { length: 100 }),
    second_surname_db: varchar('second_surname_db', { length: 100 }),
    similarity_score: numeric('similarity_score', { precision: 5, scale: 4 }).notNull(),
    csv_row_data: jsonb('csv_row_data').notNull(),
    selected_user_id: integer('selected_user_id').references(() => userTable.id_user),
    processed: boolean('processed').default(false),
    decision_action: varchar('decision_action', { length: 20 }), // 'link', 'create_new', 'skip'
    notes: varchar('notes', { length: 500 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Tipos exportados para TypeScript
export type ImportJobSelectModel = InferSelectModel<typeof importJobTable>;
export type ImportJobInsertModel = InferInsertModel<typeof importJobTable>;
export type ImportJobUpdateModel = Partial<ImportJobInsertModel>;

export type ImportDecisionSelectModel = InferSelectModel<typeof importDecisionsTable>;
export type ImportDecisionInsertModel = InferInsertModel<typeof importDecisionsTable>;
export type ImportDecisionUpdateModel = Partial<ImportDecisionInsertModel>;

// Estados válidos para trabajos de importación
export enum ImportJobStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

// Tipos de importación
export enum ImportType {
    CSV = 'csv',
    SAGE = 'sage',
    EXCEL = 'excel',
    MOODLE = 'moodle'
}

// Acciones de decisión
export enum DecisionAction {
    LINK = 'link',
    CREATE_NEW = 'create_new',
    SKIP = 'skip'
}