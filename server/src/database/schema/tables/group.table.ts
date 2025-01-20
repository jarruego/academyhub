import { pgTable, serial, integer, text, date } from "drizzle-orm/pg-core";
import { courseTable } from "./course.table";
import { TIMESTAMPS } from "./timestamps";
import { InferSelectModel } from "drizzle-orm";

export const groupTable = pgTable("groups", {
  id_group: serial("id_group").primaryKey(),
  moodle_id: integer("moodle_id").notNull(),
  group_name: text("group_name").notNull(),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  description: text("description").notNull(),
  start_date: date("start_date").notNull(),
  end_date: date("end_date").notNull(),
    ...TIMESTAMPS,
});

export type GroupSelectModel = InferSelectModel<typeof groupTable>;