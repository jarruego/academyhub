import { integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { centerTable } from "./center.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Acceso externo de un centro a su consultoría (ver docs/consultoria.md,
// "Guards y acceso externo"): token opaco aleatorio. Dos representaciones
// del mismo secreto, cada una para un uso distinto (decisión 2026-09-17,
// pedida por el usuario — antes solo se guardaba el hash):
// - `token_hash` (SHA-256, determinista): lo único que usa `ConsultingTokenGuard`
//   para autenticar cada petición — búsqueda por igualdad, nunca se descifra.
// - `token_encrypted` (AES-256-GCM vía `APP_MASTER_KEY`, reversible — mismo
//   mecanismo que la contraseña SMTP de organización): permite que ADMIN
//   vuelva a ver/copiar el enlace en cualquier momento desde la ficha del
//   centro, sin tener que regenerarlo. Nullable por si `APP_MASTER_KEY` no
//   estuviera disponible al generarlo (degradación seguida en `secrets.util.ts`).
// Un único token por centro (id_center es la propia PK); generarlo de nuevo
// sustituye ambos valores, invalidando el enlace viejo al momento.
export const consultingCenterTokenTable = academyhubSchema.table('consulting_center_tokens', {
  id_center: integer().primaryKey().references(() => centerTable.id_center),
  token_hash: text().notNull(),
  token_encrypted: text(),
  created_at: timestamp().notNull().defaultNow(),
  last_used_at: timestamp(),
  revoked_at: timestamp(),
}, (table) => ({
  uniqueTokenHashIdx: uniqueIndex("idx_consulting_center_tokens_unique_token_hash").on(table.token_hash),
}));

export type ConsultingCenterTokenSelectModel = InferSelectModel<typeof consultingCenterTokenTable>;
export type ConsultingCenterTokenInsertModel = InferInsertModel<typeof consultingCenterTokenTable>;
