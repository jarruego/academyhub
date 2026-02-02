import { companyTable } from "./schema/tables/company.table";
import { centerTable } from "./schema/tables/center.table";
import { authUserTable } from "./schema/tables/auth_user.table";
import { courseTable } from "./schema/tables/course.table";
import { groupTable } from "./schema/tables/group.table";
import { userTable } from "./schema/tables/user.table";
import { moodleUserTable } from "./schema/tables/moodle_user.table";
import { userGroupTable } from "./schema/tables/user_group.table";
import { userRolesTable } from "./schema/tables/user_roles.table";
import { userCenterTable } from "./schema/tables/user_center.table";
import { userCourseTable } from "./schema/tables/user_course.table";
import { importJobTable, importDecisionsTable } from "./schema/tables/import.table";
import { organizationSettingsTable } from "./schema/tables/organization_settings.table";
import { schedulerLockTable } from "./schema/tables/scheduler_lock.table";
// import { enrollmentStatus } from "./schema/tables/user_course.table";
import { documentType, gender } from "./schema/tables/user.table";
import { courseModality } from "./schema/tables/course.table";

export const auth_users = authUserTable;
export const companies = companyTable;
export const centers = centerTable;
export const courses = courseTable;
export const groups = groupTable;
export const users = userTable;
export const moodle_users = moodleUserTable;
export const user_groups = userGroupTable;
export const user_roles = userRolesTable;
export const user_center = userCenterTable;
export const user_course = userCourseTable;
export const import_jobs = importJobTable;
export const import_decisions = importDecisionsTable;
export const organization_settings = organizationSettingsTable;
export const scheduler_locks = schedulerLockTable;

// Enum Data Types
export const courseModailitySchema = courseModality;
export const genderSchema = gender;
export const document_type = documentType;
// export const enrollment_status = enrollmentStatus;

// Re-export types for convenience
export type UsersColumns = typeof users;
export type CentersColumns = typeof centers;
export type CompaniesColumns = typeof companies;
export type CoursesColumns = typeof courses;
export type GroupsColumns = typeof groups;
export type OrganizationSettingsColumns = typeof organization_settings;
