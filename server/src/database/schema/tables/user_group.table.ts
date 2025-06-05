import { pgTable, integer, primaryKey, date, decimal, timestamp } from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";
import { userTable } from "./user.table";
import { groupTable } from "./group.table";
import { centerTable } from "./center.table";

export const userGroupTable = pgTable("user_group", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_group: integer("id_group").notNull().references(() => groupTable.id_group),
  id_center: integer("id_center").references(() => centerTable.id_center),
  join_date: date({mode: 'date'}).defaultNow(),
  completion_percentage: decimal({ precision: 5, scale: 2 }),
  time_spent: integer("time_spent"),
  last_access: timestamp("last_access"),
}, (table) => {
  return {
    pk: primaryKey(table.id_user, table.id_group)
  };
});

export type UserGroupSelectModel = InferSelectModel<typeof userGroupTable>;
export type UserGroupInsertModel = UserGroupSelectModel; // No usamos InferInsertModel porque los ids no son autoincrementales
export type UserGroupUpdateModel = Partial<UserGroupInsertModel>;
