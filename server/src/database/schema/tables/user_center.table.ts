import { pgTable, integer, primaryKey, timestamp, text, boolean, index } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { centerTable } from "./center.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const userCenterTable = pgTable("user_center", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_center: integer("id_center").notNull().references(() => centerTable.id_center),
  start_date: timestamp("start_date", { withTimezone: true, mode: 'date' }),
  end_date: timestamp("end_date", { withTimezone: true, mode: 'date' }),
  is_main_center: boolean('is_main_center').notNull().default(false),
  
}, (table) => {
  return {
    pk: primaryKey(table.id_user, table.id_center),
    // id_center: lookup inverso "usuarios de un centro" (el PK indexa id_user primero)
    centerIdx: index("idx_user_center_id_center").on(table.id_center),
  };
});

export type UserCenterSelectModel = InferSelectModel<typeof userCenterTable>;
export type UserCenterInsertModel = InferInsertModel<typeof userCenterTable>;
export type UserCenterUpdateModel = Partial<UserCenterInsertModel>;


