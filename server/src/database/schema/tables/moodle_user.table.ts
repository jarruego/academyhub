import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { TIMESTAMPS } from "./timestamps";

export const moodleUserTable = pgTable("moodle_users", {
    id_moodle_user: serial("id_moodle_user").primaryKey(),
    id_user: integer("id_user").notNull().references(() => userTable.id_user),
    moodle_id: integer("moodle_id").notNull().unique(),
    moodle_username: text("moodle_username").notNull().unique(),
    moodle_password: text("moodle_password"),
    ...TIMESTAMPS
});

// Modelos generados por Drizzle
export type MoodleUserSelectModel = InferSelectModel<typeof moodleUserTable>;
export type MoodleUserInsertModel = InferInsertModel<typeof moodleUserTable>;
export type MoodleUserUpdateModel = Partial<MoodleUserInsertModel>;