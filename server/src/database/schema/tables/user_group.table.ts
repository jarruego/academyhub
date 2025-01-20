
import { pgTable, serial, integer, date, decimal, timestamp } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { groupTable } from "./group.table";
import { InferSelectModel } from "drizzle-orm";

export const userGroupTable = pgTable("user_group", {
  id_user_group: serial("id_user_group").primaryKey(),
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_group: integer("id_group").notNull().references(() => groupTable.id_group),
  join_date: date({mode: 'date'}),
  completion_percentage: decimal({ precision: 5, scale: 2 }),
  time_spent: integer("time_spent"),
  last_access: timestamp("last_access"),
});

export type UserGroupSelectModel = InferSelectModel<typeof userGroupTable>;