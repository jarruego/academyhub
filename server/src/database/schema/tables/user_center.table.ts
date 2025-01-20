import { pgTable, serial, integer, date } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { centerTable } from "./center.table";
import { InferSelectModel } from "drizzle-orm";

export const userCenterTable = pgTable("user_center", {
  id_user_center: serial("id_user_center").primaryKey(),
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_center: integer("id_center").notNull().references(() => centerTable.id_center),
  start_date: date("start_date").notNull(),
  end_date: date("end_date"),
});

export type UserCenterSelectModel = InferSelectModel<typeof userCenterTable>;
