import { pgTable, integer, date, decimal, doublePrecision, primaryKey } from "drizzle-orm/pg-core";
import { userTable } from "./user.table";
import { courseTable } from "./course.table";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
// import { EnrollmentStatus } from "src/types/course/enrollment-status.enum";

// export const enrollmentStatus = pgEnum('enrollment_status', Object.values(EnrollmentStatus) as [string, ...string[]]);

export const userCourseTable = pgTable("user_course", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  enrollment_date: date({mode: 'date'}),
  // status: enrollmentStatus("status"),
  completion_percentage: decimal({ precision: 5, scale: 2 }),
  time_spent: integer("time_spent"),
}, (table) => {
  return {
    pk: primaryKey({columns: [table.id_user, table.id_course]})
  };
});

export type UserCourseSelectModel = InferSelectModel<typeof userCourseTable>;
export type UserCourseInsertModel = InferInsertModel<typeof userCourseTable>;
export type UserCourseUpdateModel = Partial<UserCourseInsertModel>;


