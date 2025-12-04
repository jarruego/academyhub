import { pgTable, integer, primaryKey, date, decimal, timestamp } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { userTable } from "./user.table";
import { groupTable } from "./group.table";
import { centerTable } from "./center.table";
import { userRolesTable } from "./user_roles.table";

export const userGroupTable = pgTable("user_group", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_group: integer("id_group").notNull().references(() => groupTable.id_group),
  // rol aplicado al usuario dentro del grupo (referencia a user_roles.id_role)
  id_role: integer("id_role").references(() => userRolesTable.id_role),
  id_center: integer("id_center").references(() => centerTable.id_center),
  join_date: date({ mode: 'date' }).defaultNow(),
  completion_percentage: decimal({ precision: 5, scale: 2 }),
  time_spent: integer("time_spent"),
  last_access: timestamp("last_access"),
  // Fecha/hora en la que este usuario se subió al grupo en Moodle (null si no sincronizado)
  moodle_synced_at: timestamp("moodle_synced_at"),
}, (table) => {
  return {
    pk: primaryKey(table.id_user, table.id_group)
  };
});

export type UserGroupSelectModel = InferSelectModel<typeof userGroupTable>;
// Allow optional fields on insert (id_role and last_access may be omitted/null at creation)
export type UserGroupInsertModel = InferInsertModel<typeof userGroupTable>;
//export type UserGroupInsertModel = Partial<UserGroupSelectModel> & { id_user: number; id_group: number };
export type UserGroupUpdateModel = Partial<UserGroupInsertModel>;
