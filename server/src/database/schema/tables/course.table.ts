import { pgTable, serial, integer, text, date, boolean, decimal, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { CourseModality } from "src/types/course/course-modality.enum";
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
  // price_per_hour: decimal({ precision: 10, scale: 2 }),
  // fundae_id: text(),
  modality: courseModality().notNull(),
  // hours: integer(),
  // active: boolean().notNull(),
  ...TIMESTAMPS,
});
export type CourseSelectModel = InferSelectModel<typeof courseTable>;
export type CourseInsertModel = Omit<CourseSelectModel, 'id_course' | 'createdAt' | 'updatedAt'>;
export type CourseUpdateModel = Partial<CourseInsertModel>;