import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { index, integer, serial, text, timestamp } from "drizzle-orm/pg-core";
import { academyhubSchema } from "../pg-schema";
import { authUserTable } from "./auth_user.table";
import { catalogCourseTable, courseModality } from "./course.table";
import { TIMESTAMPS } from "./timestamps";
import { userTable } from "./user.table";
import { InterestSource, InterestStatus } from "../../../types/course-interest/course-interest.enums";

export const interestStatus = academyhubSchema.enum("interest_status", Object.values(InterestStatus) as [string, ...string[]]);
export const interestSource = academyhubSchema.enum("interest_source", Object.values(InterestSource) as [string, ...string[]]);

// Bolsa general de personas interesadas en un curso de catálogo, sin edición
// asignada todavía. Cuando se incorpora a una edición concreta se crea una
// `course_candidates` (id_interest apunta aquí) y este registro pasa a
// CONVOCADO. Ver "Intereses formativos" en docs/course-catalog.md.
export const courseInterestTable = academyhubSchema.table("course_interests", {
  id_interest: serial().primaryKey(),
  id_catalog_course: integer().notNull().references(() => catalogCourseTable.id_catalog_course),
  id_user: integer().notNull().references(() => userTable.id_user),
  status: interestStatus().notNull().default(InterestStatus.INTERESTED),
  interest_date: timestamp({ withTimezone: true }).notNull().defaultNow(),
  source: interestSource(),
  preferred_modality: courseModality(),
  availability: text(),
  notes: text(),
  assigned_to: integer().references(() => authUserTable.id),
  created_by: integer().references(() => authUserTable.id),
  closed_at: timestamp({ withTimezone: true }),
  ...TIMESTAMPS,
}, (table) => ({
  catalogCourseIdx: index("idx_course_interests_catalog_course").on(table.id_catalog_course),
  userIdx: index("idx_course_interests_id_user").on(table.id_user),
  statusIdx: index("idx_course_interests_status").on(table.status),
  assignedToIdx: index("idx_course_interests_assigned_to").on(table.assigned_to),
}));

export type CourseInterestSelectModel = InferSelectModel<typeof courseInterestTable>;
export type CourseInterestInsertModel = InferInsertModel<typeof courseInterestTable>;
export type CourseInterestUpdateModel = Partial<CourseInterestInsertModel>;
