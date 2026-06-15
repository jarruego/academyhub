import { pgTable, serial, integer, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Registro de auditoría de operaciones mutantes (quién hizo qué y cuándo).
// Lo rellena AuditInterceptor a nivel HTTP. NO guarda cuerpos de petición para
// evitar registrar secretos (contraseñas, tokens). `actor_id` SIN FK a propósito:
// el log debe sobrevivir al borrado del usuario que originó la acción.
export const auditLogTable = pgTable('audit_log', {
    id: serial('id').primaryKey(),
    actor_id: integer('actor_id'),                       // auth_user.id (null si no autenticado, p.ej. login)
    actor_username: varchar('actor_username', { length: 64 }),
    actor_role: varchar('actor_role', { length: 16 }),
    method: varchar('method', { length: 10 }),           // POST | PUT | PATCH | DELETE
    path: text('path'),                                  // URL solicitada
    target: text('target'),                              // params de ruta (JSON compacto), p.ej. {"id":"5"}
    status_code: integer('status_code'),
    ip: varchar('ip', { length: 64 }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
    return {
        createdAtIdx: index('idx_audit_log_created_at').on(table.created_at),
    };
});

export type AuditLogSelectModel = InferSelectModel<typeof auditLogTable>;
export type AuditLogInsertModel = InferInsertModel<typeof auditLogTable>;
