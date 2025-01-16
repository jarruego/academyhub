
import { pgTable, serial, integer, text, date, boolean, decimal, pgEnum } from "drizzle-orm/pg-core";
import { TIMESTAMPS } from "./timestamps";

const modalityEnum = pgEnum('modality', ['Online', 'Presential']);

export const courseTable = pgTable('courses', {
  id_course: serial().primaryKey(),
  moodle_id: integer().notNull(),
  course_name: text().notNull(),
  category: text().notNull(),
  short_name: text().notNull(),
  start_date: text().notNull(),
  end_date: text().notNull(),
  fundae_id: text().notNull(),
  modality: modalityEnum().notNull(),
  hours: integer().notNull(),
  price_per_hour: decimal({ precision: 10, scale: 2 }).notNull(),
  active: boolean().notNull(),
  ...TIMESTAMPS,
});