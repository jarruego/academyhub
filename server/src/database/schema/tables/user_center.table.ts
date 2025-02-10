import { pgTable, integer, primaryKey, date, text } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { centerTable } from "./center.table";
import { InferSelectModel } from "drizzle-orm";

export const userCenterTable = pgTable("user_center", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_center: integer("id_center").notNull().references(() => centerTable.id_center),
  start_date: date({mode: 'date'}),
  end_date: date({mode: 'date'}),
}, (table) => {
  return {
    pk: primaryKey(table.id_user, table.id_center)
  };
});

export type UserCenterSelectModel = Partial<InferSelectModel<typeof userCenterTable>>;
export type UserCenterInsertModel = InferSelectModel<typeof userCenterTable>;
export type UserCenterUpdateModel = Partial<InferSelectModel<typeof userCenterTable>>;

