import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";

/**
 * Snapshots de la Auditoría de Moodle persistidos en BD para sobrevivir a
 * reinicios del servidor (docs/moodle-audit.md). Una fila por tipo:
 * - kind "users": payload = AuditMoodleUser[] (proyección de todos los usuarios).
 * - kind "enrolments": payload = { courses: AuditMoodleCourse[] } con los
 *   matriculados por curso.
 * Se escriben solo al descargar de Moodle; leerlos no cuesta llamadas.
 */
export const moodleAuditSnapshotTable = pgTable("moodle_audit_snapshot", {
    kind: text("kind").primaryKey(),
    fetched_at: timestamp("fetched_at").notNull(),
    moodle_calls: integer("moodle_calls").notNull().default(0),
    payload: jsonb("payload").notNull(),
});

/**
 * Cuentas de Moodle protegidas manualmente contra el borrado desde la
 * herramienta de limpieza ("intocables"). Clave por moodle_id porque la cuenta
 * puede no tener fila en moodle_users (sin vínculo local).
 */
export const moodleProtectedUserTable = pgTable("moodle_protected_user", {
    moodle_id: integer("moodle_id").primaryKey(),
    moodle_username: text("moodle_username").notNull(),
    ...TIMESTAMPS,
});

export type MoodleAuditSnapshotSelectModel = InferSelectModel<typeof moodleAuditSnapshotTable>;
export type MoodleAuditSnapshotInsertModel = InferInsertModel<typeof moodleAuditSnapshotTable>;
export type MoodleProtectedUserSelectModel = InferSelectModel<typeof moodleProtectedUserTable>;
export type MoodleProtectedUserInsertModel = InferInsertModel<typeof moodleProtectedUserTable>;
