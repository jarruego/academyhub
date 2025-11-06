import { pgTable, unique, serial, varchar, timestamp, integer, text, boolean, numeric, foreignKey, jsonb, primaryKey, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const courseModality = pgEnum("course_modality", ['Online', 'Presencial', 'Mixta'])
export const documentType = pgEnum("document_type", ['DNI', 'NIE'])
export const gender = pgEnum("gender", ['Male', 'Female', 'Other'])


export const authUsers = pgTable("auth_users", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 32 }).notNull(),
	lastName: varchar({ length: 64 }),
	email: varchar({ length: 128 }).notNull(),
	username: varchar({ length: 32 }).notNull(),
	password: varchar({ length: 256 }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	role: varchar({ length: 16 }).default('viewer').notNull(),
}, (table) => [
	unique("auth_users_email_unique").on(table.email),
	unique("auth_users_username_unique").on(table.username),
]);

export const courses = pgTable("courses", {
	idCourse: serial("id_course").primaryKey().notNull(),
	moodleId: integer("moodle_id"),
	courseName: text("course_name").notNull(),
	category: text(),
	shortName: text("short_name").notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	modality: courseModality().notNull(),
	hours: integer(),
	active: boolean().notNull(),
	fundaeId: text("fundae_id"),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	pricePerHour: numeric("price_per_hour", { precision: 10, scale:  2 }),
});

export const userRoles = pgTable("user_roles", {
	idRole: serial("id_role").primaryKey().notNull(),
	roleShortname: text("role_shortname").notNull(),
	roleDescription: text("role_description"),
});

export const centers = pgTable("centers", {
	idCenter: serial("id_center").primaryKey().notNull(),
	centerName: varchar("center_name", { length: 128 }).notNull(),
	employerNumber: varchar("employer_number", { length: 128 }),
	idCompany: integer("id_company").notNull(),
	contactPerson: varchar("contact_person", { length: 64 }),
	contactPhone: varchar("contact_phone", { length: 32 }),
	contactEmail: varchar("contact_email", { length: 128 }),
	importId: varchar("import_id", { length: 128 }),
}, (table) => [
	foreignKey({
			columns: [table.idCompany],
			foreignColumns: [companies.idCompany],
			name: "centers_id_company_companies_id_company_fk"
		}),
]);

export const companies = pgTable("companies", {
	idCompany: serial("id_company").primaryKey().notNull(),
	companyName: varchar("company_name", { length: 128 }).notNull(),
	corporateName: varchar("corporate_name", { length: 256 }).notNull(),
	cif: varchar({ length: 12 }).notNull(),
	importId: varchar("import_id", { length: 128 }),
}, (table) => [
	unique("companies_cif_unique").on(table.cif),
]);

export const groups = pgTable("groups", {
	idGroup: serial("id_group").primaryKey().notNull(),
	moodleId: integer("moodle_id"),
	groupName: text("group_name").notNull(),
	idCourse: integer("id_course").notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	fundaeId: text("fundae_id"),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.idCourse],
			foreignColumns: [courses.idCourse],
			name: "groups_id_course_courses_id_course_fk"
		}),
	unique("groups_moodle_id_unique").on(table.moodleId),
]);

export const users = pgTable("users", {
	idUser: serial("id_user").primaryKey().notNull(),
	name: text().notNull(),
	firstSurname: text("first_surname"),
	secondSurname: text("second_surname"),
	email: text(),
	registrationDate: timestamp("registration_date", { withTimezone: true, mode: 'string' }),
	dni: text(),
	phone: text(),
	nss: text(),
	professionalCategory: text("professional_category"),
	disability: boolean(),
	terrorismVictim: boolean("terrorism_victim"),
	genderViolenceVictim: boolean("gender_violence_victim"),
	educationLevel: text("education_level"),
	address: text(),
	postalCode: text("postal_code"),
	city: text(),
	province: text(),
	country: text(),
	observations: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	documentType: documentType("document_type").default('DNI'),
	gender: gender().default('Other'),
	seasonalWorker: boolean().default(false),
	erteLaw: boolean().default(false),
	accreditationDiploma: text().default('N'),
	salaryGroup: integer("salary_group"),
	birthDate: timestamp("birth_date", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("users_dni_unique").on(table.dni),
	unique("users_nss_unique").on(table.nss),
]);

export const moodleUsers = pgTable("moodle_users", {
	idMoodleUser: serial("id_moodle_user").primaryKey().notNull(),
	idUser: integer("id_user").notNull(),
	moodleId: integer("moodle_id").notNull(),
	moodleUsername: text("moodle_username").notNull(),
	moodlePassword: text("moodle_password"),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idUser],
			foreignColumns: [users.idUser],
			name: "moodle_users_id_user_users_id_user_fk"
		}),
	unique("moodle_users_moodle_id_unique").on(table.moodleId),
	unique("moodle_users_moodle_username_unique").on(table.moodleUsername),
]);

export const importDecisions = pgTable("import_decisions", {
	id: serial().primaryKey().notNull(),
	importSource: varchar("import_source", { length: 50 }).notNull(),
	dniCsv: varchar("dni_csv", { length: 20 }),
	nameCsv: varchar("name_csv", { length: 100 }),
	firstSurnameCsv: varchar("first_surname_csv", { length: 100 }),
	secondSurnameCsv: varchar("second_surname_csv", { length: 100 }),
	nameDb: varchar("name_db", { length: 100 }),
	firstSurnameDb: varchar("first_surname_db", { length: 100 }),
	secondSurnameDb: varchar("second_surname_db", { length: 100 }),
	similarityScore: numeric("similarity_score", { precision: 5, scale:  4 }).notNull(),
	csvRowData: jsonb("csv_row_data").notNull(),
	selectedUserId: integer("selected_user_id"),
	processed: boolean().default(false),
	decisionAction: varchar("decision_action", { length: 20 }),
	notes: varchar({ length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.selectedUserId],
			foreignColumns: [users.idUser],
			name: "import_decisions_selected_user_id_users_id_user_fk"
		}),
]);

export const importJobs = pgTable("import_jobs", {
	id: serial().primaryKey().notNull(),
	jobId: varchar("job_id", { length: 50 }).notNull(),
	importType: varchar("import_type", { length: 50 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	totalRows: integer("total_rows").default(0),
	processedRows: integer("processed_rows").default(0),
	errorMessage: varchar("error_message", { length: 500 }),
	resultSummary: jsonb("result_summary"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("import_jobs_job_id_unique").on(table.jobId),
]);

export const userCourseMoodleRole = pgTable("user_course_moodle_role", {
	idUser: integer("id_user").notNull(),
	idCourse: integer("id_course").notNull(),
	idRole: integer("id_role").notNull(),
	roleShortname: text("role_shortname").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idUser],
			foreignColumns: [users.idUser],
			name: "user_course_moodle_role_id_user_users_id_user_fk"
		}),
	foreignKey({
			columns: [table.idCourse],
			foreignColumns: [courses.idCourse],
			name: "user_course_moodle_role_id_course_courses_id_course_fk"
		}),
	primaryKey({ columns: [table.idUser, table.idCourse, table.idRole], name: "user_course_moodle_role_id_user_id_course_id_role_pk"}),
]);

export const userCenter = pgTable("user_center", {
	idUser: integer("id_user").notNull(),
	idCenter: integer("id_center").notNull(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	isMainCenter: boolean("is_main_center").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idUser],
			foreignColumns: [users.idUser],
			name: "user_center_id_user_users_id_user_fk"
		}),
	foreignKey({
			columns: [table.idCenter],
			foreignColumns: [centers.idCenter],
			name: "user_center_id_center_centers_id_center_fk"
		}),
	primaryKey({ columns: [table.idUser, table.idCenter], name: "user_center_id_user_id_center_pk"}),
]);

export const userCourse = pgTable("user_course", {
	idUser: integer("id_user").notNull(),
	idCourse: integer("id_course").notNull(),
	enrollmentDate: date("enrollment_date"),
	completionPercentage: numeric("completion_percentage", { precision: 5, scale:  2 }),
	timeSpent: integer("time_spent"),
	idMoodleUser: integer("id_moodle_user"),
}, (table) => [
	foreignKey({
			columns: [table.idUser],
			foreignColumns: [users.idUser],
			name: "user_course_id_user_users_id_user_fk"
		}),
	foreignKey({
			columns: [table.idCourse],
			foreignColumns: [courses.idCourse],
			name: "user_course_id_course_courses_id_course_fk"
		}),
	foreignKey({
			columns: [table.idMoodleUser],
			foreignColumns: [moodleUsers.idMoodleUser],
			name: "user_course_id_moodle_user_moodle_users_id_moodle_user_fk"
		}),
	primaryKey({ columns: [table.idUser, table.idCourse], name: "user_course_id_user_id_course_pk"}),
]);

export const userGroup = pgTable("user_group", {
	idUser: integer("id_user").notNull(),
	idGroup: integer("id_group").notNull(),
	idRole: integer("id_role"),
	idCenter: integer("id_center"),
	joinDate: date("join_date").defaultNow(),
	completionPercentage: numeric("completion_percentage", { precision: 5, scale:  2 }),
	timeSpent: integer("time_spent"),
	lastAccess: timestamp("last_access", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.idUser],
			foreignColumns: [users.idUser],
			name: "user_group_id_user_users_id_user_fk"
		}),
	foreignKey({
			columns: [table.idGroup],
			foreignColumns: [groups.idGroup],
			name: "user_group_id_group_groups_id_group_fk"
		}),
	foreignKey({
			columns: [table.idCenter],
			foreignColumns: [centers.idCenter],
			name: "user_group_id_center_centers_id_center_fk"
		}),
	foreignKey({
			columns: [table.idRole],
			foreignColumns: [userRoles.idRole],
			name: "user_group_id_role_user_roles_id_role_fk"
		}),
	primaryKey({ columns: [table.idUser, table.idGroup], name: "user_group_id_user_id_group_pk"}),
]);
