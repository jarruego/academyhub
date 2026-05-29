import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const revokedTokensTable = pgTable('revoked_tokens', {
  jti: varchar({ length: 36 }).primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
});

export type RevokedTokenSelectModel = InferSelectModel<typeof revokedTokensTable>;
export type RevokedTokenInsertModel = InferInsertModel<typeof revokedTokensTable>;
