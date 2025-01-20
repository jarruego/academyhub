import { pgTable, serial, integer, date, decimal, pgEnum } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { courseTable } from "./course.table";
import { InferSelectModel } from "drizzle-orm";
import { EnrollmentStatus } from "src/types/course/enrollment-status.enum";

export const enrollmentStatus = pgEnum('enrollment-status', Object.values(EnrollmentStatus) as [string, ...string[]]);

export const userCourseTable = pgTable("user_course", {
  id_user_course: serial("id_user_course").primaryKey(),
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  enrollment_date: date("enrollment_date"),
  status: enrollmentStatus("status"),
  completion_percentage: decimal({ precision: 5, scale: 2 }),
  time_spent: integer("time_spent"),
});

export type UserCourseSelectModel = InferSelectModel<typeof userCourseTable>;
