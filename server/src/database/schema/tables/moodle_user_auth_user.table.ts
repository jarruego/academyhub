import { pgTable, serial, integer, varchar } from "drizzle-orm/pg-core";
import { moodleUserTable } from "./moodle_user.table";
import { authUserTable } from "./auth_user.table";
import { TIMESTAMPS } from "./timestamps";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const moodleUserAuthUserTable = pgTable("moodle_user_auth_user", {
  id: serial("id").primaryKey(),
  id_moodle_user: integer("id_moodle_user").notNull().references(() => moodleUserTable.id_moodle_user),
  id_auth_user: integer("id_auth_user").notNull().references(() => authUserTable.id),
  moodle_token: varchar("moodle_token", { length: 128 }).notNull(),
  ...TIMESTAMPS,
});

export type MoodleUserAuthUserSelectModel = InferSelectModel<typeof moodleUserAuthUserTable>;
export type MoodleUserAuthUserInsertModel = InferInsertModel<typeof moodleUserAuthUserTable>;
export type MoodleUserAuthUserUpdateModel = Partial<MoodleUserAuthUserInsertModel>;
