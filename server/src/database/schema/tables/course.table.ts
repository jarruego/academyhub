import { pgTable, serial, integer, text, date, boolean, decimal, pgEnum } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
import { CourseModality } from "src/types/course/course-modality.enum";

export const courseModality = pgEnum('course_modality', [CourseModality.ONLINE, CourseModality.PRESENTIAL]);

export const courseTable = pgTable('courses', {
  id_course: serial().primaryKey(),
  moodle_id: integer().notNull(),
  course_name: text().notNull(),
  category: text().notNull(),
  short_name: text().notNull(),
  start_date: date().notNull(),
  end_date: date().notNull(),
  fundae_id: text().notNull(),
  modality: courseModality().notNull(),
  hours: integer().notNull(),
  price_per_hour: decimal({ precision: 10, scale: 2 }).notNull(),
  active: boolean().notNull(),
  ...TIMESTAMPS,
});