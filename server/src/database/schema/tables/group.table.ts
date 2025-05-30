import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { courseTable } from "./course.table";
import { TIMESTAMPS } from "./timestamps";
import { InferSelectModel } from "drizzle-orm";

export const groupTable = pgTable("groups", {
  id_group: serial("id_group").primaryKey(),
  moodle_id: integer("moodle_id").unique(),
  group_name: text("group_name").notNull(),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  description: text("description"),
  // start_date: date({mode: 'date'}),
  // end_date: date({mode: 'date'}),
  start_date: timestamp({withTimezone: true}),
  end_date: timestamp({withTimezone: true}),
  fundae_id: text(),
    ...TIMESTAMPS,
});

export type GroupSelectModel = Partial<InferSelectModel<typeof groupTable>>;
export type GroupInsertModel = Omit<InferSelectModel<typeof groupTable>, 'id_group' | 'createdAt' | 'updatedAt'>
export type GroupUpdateModel = Partial<InferSelectModel<typeof groupTable>>;