import { pgTable, serial, integer, text, date, boolean, decimal, pgEnum } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";
// import { CourseModality } from "src/types/course/course-modality.enum";
import { InferSelectModel } from "drizzle-orm";

// export const courseModality = pgEnum('course_modality', Object.values(CourseModality) as [string, ...string[]]);

export const courseTable = pgTable('courses', {
  id_course: serial().primaryKey(),
  moodle_id: integer(),
  course_name: text().notNull(),
  category: text(),
  short_name: text().notNull(),
  start_date: date({mode: 'date'}),
  end_date: date({mode: 'date'}),
  // price_per_hour: decimal({ precision: 10, scale: 2 }),
  // fundae_id: text(),
  // modality: courseModality(),
  // hours: integer(),
  // active: boolean().notNull(),
  ...TIMESTAMPS,
});
export type CourseSelectModel = InferSelectModel<typeof courseTable>;