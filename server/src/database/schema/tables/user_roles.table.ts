import { pgTable, serial, text } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const userRolesTable = pgTable("user_roles", {
  id_role: serial("id_role").primaryKey().notNull(),
  role_shortname: text("role_shortname").notNull(),
  role_description: text("role_description"),
});

export type UserRoleSelectModel = InferSelectModel<typeof userRolesTable>;
export type UserRoleInsertModel = InferInsertModel<typeof userRolesTable>;
