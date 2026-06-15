import { pgTable, serial, integer, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Registro de envíos de correo: quién, cuándo, a quién, con qué plantilla/asunto
// y en qué modo de remitente. Lo escribe MailService best-effort (no rompe el
// envío). NO se guarda el cuerpo del correo (contiene {CLAVE_MOODLE}). Sin FK en
// actor_id/template_id a propósito: el log sobrevive al borrado de esas entidades.
export const emailLogTable = pgTable('email_log', {
    id: serial('id').primaryKey(),
    actor_id: integer('actor_id'),                          // auth_user.id que originó el envío
    actor_username: varchar('actor_username', { length: 64 }),
    actor_role: varchar('actor_role', { length: 16 }),
    recipient: text('recipient'),                           // destinatario(s)
    subject: text('subject'),                               // asunto (ya resuelto)
    template_id: integer('template_id'),
    template_name: varchar('template_name', { length: 128 }),
    sender_mode: varchar('sender_mode', { length: 16 }),    // default | auth | tutor
    from_name: varchar('from_name', { length: 255 }),       // nombre del remitente mostrado
    from_email: varchar('from_email', { length: 255 }),     // correo real que ve el destinatario (resuelto en el envío)
    via_moodle: boolean('via_moodle').default(false),
    status: varchar('status', { length: 16 }).notNull(),    // sent | failed
    error_message: text('error_message'),
    notes: text('notes'),                                   // anotaciones futuras
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
    return {
        createdAtIdx: index('idx_email_log_created_at').on(table.created_at),
    };
});

export type EmailLogSelectModel = InferSelectModel<typeof emailLogTable>;
export type EmailLogInsertModel = InferInsertModel<typeof emailLogTable>;
