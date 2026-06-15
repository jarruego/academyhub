import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { pgTable, serial, text, integer, boolean, index } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { TIMESTAMPS } from "./timestamps";

export const moodleUserTable = pgTable("moodle_users", {
    id_moodle_user: serial("id_moodle_user").primaryKey(),
    id_user: integer("id_user").notNull().references(() => userTable.id_user),
    moodle_id: integer("moodle_id").notNull().unique(),
    moodle_username: text("moodle_username").notNull().unique(),
    moodle_password: text("moodle_password"),
    is_main_user: boolean("is_main_user").notNull().default(false),
    ...TIMESTAMPS
}, (table) => {
    return {
        // id_user: FK usada para resolver el moodle_user de un usuario de dominio
        userIdx: index("idx_moodle_users_id_user").on(table.id_user),
    };
});

// Modelos generados por Drizzle
export type MoodleUserSelectModel = InferSelectModel<typeof moodleUserTable>;
export type MoodleUserInsertModel = InferInsertModel<typeof moodleUserTable>;
export type MoodleUserUpdateModel = Partial<MoodleUserInsertModel>;