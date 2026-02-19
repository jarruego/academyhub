import { pgTable, serial, integer, text, date, boolean, decimal, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { CourseModality } from "../../../types/course/course-modality.enum";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const courseModality = pgEnum('course_modality', Object.values(CourseModality) as [string, ...string[]]);

export const courseTable = pgTable('courses', {
  id_course: serial().primaryKey(),
  moodle_id: integer(),
  course_name: text().notNull(),
  category: text(),
  short_name: text().notNull(),
  start_date: timestamp({withTimezone: true}),
  end_date: timestamp({withTimezone: true}),
  modality: courseModality().notNull(),
  hours: integer(), 
  price_per_hour: decimal({ precision: 10, scale: 2 }).$type<number>(),
  active: boolean().notNull(),
  fundae_id: text(),
  contents: text(), // HTML largo
  ...TIMESTAMPS,
});

export type CourseSelectModel = InferSelectModel<typeof courseTable>;
export type CourseInsertModel = InferInsertModel<typeof courseTable>;
export type CourseUpdateModel = Partial<CourseInsertModel>;



