import { serial, integer, varchar, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Registro de envíos de SMS: quién, cuándo, a quién, con qué plantilla y
// remitente. Lo escribe SmsService best-effort (no rompe el envío). NO se
// guarda el texto del mensaje (puede contener {CLAVE_MOODLE}), igual que
// email_log. Sin FK en actor_id/template_id a propósito: el log sobrevive al
// borrado de esas entidades.
export const smsLogTable = academyhubSchema.table('sms_log', {
    id: serial('id').primaryKey(),
    actor_id: integer('actor_id'),                          // auth_user.id que originó el envío
    actor_username: varchar('actor_username', { length: 64 }),
    actor_role: varchar('actor_role', { length: 16 }),
    recipient: varchar('recipient', { length: 32 }),         // teléfono en formato E.164 enviado
    template_id: integer('template_id'),
    template_name: varchar('template_name', { length: 128 }),
    sender_name: varchar('sender_name', { length: 64 }),
    mailrelay_id: integer('mailrelay_id'),                   // id devuelto por Mailrelay (POST /sms/send), para refrescar estado
    status: varchar('status', { length: 16 }).notNull(),      // sent | failed (resultado de la llamada a Mailrelay)
    error_message: text('error_message'),
    // Estado real de entrega en Mailrelay, solo tras "Actualizar estado" (no hay webhook):
    // not_processed | processed | ignored | delivered | failed | expired
    mailrelay_status: varchar('mailrelay_status', { length: 16 }),
    mailrelay_status_checked_at: timestamp('mailrelay_status_checked_at', { withTimezone: true }),
    parts_count: integer('parts_count'),
    used_credits: numeric('used_credits'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
    return {
        createdAtIdx: index('idx_sms_log_created_at').on(table.created_at),
    };
});

export type SmsLogSelectModel = InferSelectModel<typeof smsLogTable>;
export type SmsLogInsertModel = InferInsertModel<typeof smsLogTable>;
