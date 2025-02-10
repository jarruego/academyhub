import { pgTable, integer, text, primaryKey } from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";
import { userTable } from "./user.table";
import { courseTable } from "./course.table";

export const userCourseMoodleRoleTable = pgTable("user_course_moodle_role", {
  id_user: integer("id_user").notNull().references(() => userTable.id_user),
  id_course: integer("id_course").notNull().references(() => courseTable.id_course),
  id_role: integer("id_role").notNull(),
  role_shortname: text("role_shortname").notNull(),
}, (table) => {
  return {
    pk: primaryKey(table.id_user, table.id_course, table.id_role)
  };
});

// export type UserCourseRoleSelectModel = Partial<InferSelectModel<typeof userCourseMoodleRoleTable>>;
export type UserCourseRoleInsertModel = InferSelectModel<typeof userCourseMoodleRoleTable>;
// export type UserCourseRoleUpdateModel = Partial<InferSelectModel<typeof userCourseMoodleRoleTable>>;