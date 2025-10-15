import { relations } from "drizzle-orm/relations";
import { companies, centers, courses, groups, users, moodleUsers, importDecisions, userCourseMoodleRole, userCenter, userCourse, userGroup } from "./schema";

export const centersRelations = relations(centers, ({one, many}) => ({
	company: one(companies, {
		fields: [centers.idCompany],
		references: [companies.idCompany]
	}),
	userCenters: many(userCenter),
	userGroups: many(userGroup),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	centers: many(centers),
}));

export const groupsRelations = relations(groups, ({one, many}) => ({
	course: one(courses, {
		fields: [groups.idCourse],
		references: [courses.idCourse]
	}),
	userGroups: many(userGroup),
}));

export const coursesRelations = relations(courses, ({many}) => ({
	groups: many(groups),
	userCourseMoodleRoles: many(userCourseMoodleRole),
	userCourses: many(userCourse),
}));

export const moodleUsersRelations = relations(moodleUsers, ({one, many}) => ({
	user: one(users, {
		fields: [moodleUsers.idUser],
		references: [users.idUser]
	}),
	userCourses: many(userCourse),
}));

export const usersRelations = relations(users, ({many}) => ({
	moodleUsers: many(moodleUsers),
	importDecisions: many(importDecisions),
	userCourseMoodleRoles: many(userCourseMoodleRole),
	userCenters: many(userCenter),
	userCourses: many(userCourse),
	userGroups: many(userGroup),
}));

export const importDecisionsRelations = relations(importDecisions, ({one}) => ({
	user: one(users, {
		fields: [importDecisions.selectedUserId],
		references: [users.idUser]
	}),
}));

export const userCourseMoodleRoleRelations = relations(userCourseMoodleRole, ({one}) => ({
	user: one(users, {
		fields: [userCourseMoodleRole.idUser],
		references: [users.idUser]
	}),
	course: one(courses, {
		fields: [userCourseMoodleRole.idCourse],
		references: [courses.idCourse]
	}),
}));

export const userCenterRelations = relations(userCenter, ({one}) => ({
	user: one(users, {
		fields: [userCenter.idUser],
		references: [users.idUser]
	}),
	center: one(centers, {
		fields: [userCenter.idCenter],
		references: [centers.idCenter]
	}),
}));

export const userCourseRelations = relations(userCourse, ({one}) => ({
	user: one(users, {
		fields: [userCourse.idUser],
		references: [users.idUser]
	}),
	course: one(courses, {
		fields: [userCourse.idCourse],
		references: [courses.idCourse]
	}),
	moodleUser: one(moodleUsers, {
		fields: [userCourse.idMoodleUser],
		references: [moodleUsers.idMoodleUser]
	}),
}));

export const userGroupRelations = relations(userGroup, ({one}) => ({
	user: one(users, {
		fields: [userGroup.idUser],
		references: [users.idUser]
	}),
	group: one(groups, {
		fields: [userGroup.idGroup],
		references: [groups.idGroup]
	}),
	center: one(centers, {
		fields: [userGroup.idCenter],
		references: [centers.idCenter]
	}),
}));