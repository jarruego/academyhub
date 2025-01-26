CREATE TABLE "auth_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"lastName" varchar(64),
	"email" varchar(128) NOT NULL,
	"username" varchar(32) NOT NULL,
	"password" varchar(256) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email"),
	CONSTRAINT "auth_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "centers" (
	"id_center" serial PRIMARY KEY NOT NULL,
	"center_name" varchar(128) NOT NULL,
	"employer_number" varchar(128) NOT NULL,
	"id_company" integer NOT NULL,
	"contact_person" varchar(64) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"contact_email" varchar(128) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id_company" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(128) NOT NULL,
	"corporate_name" varchar(256) NOT NULL,
	"cif" varchar(12) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_cif_unique" UNIQUE("cif")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id_course" serial PRIMARY KEY NOT NULL,
	"moodle_id" integer,
	"course_name" text NOT NULL,
	"category" text,
	"short_name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id_group" serial PRIMARY KEY NOT NULL,
	"moodle_id" integer,
	"group_name" text NOT NULL,
	"id_course" integer NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "groups_moodle_id_unique" UNIQUE("moodle_id")
);
--> statement-breakpoint
CREATE TABLE "user_center" (
	"id_user" integer NOT NULL,
	"id_center" integer NOT NULL,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "user_course" (
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"enrollment_date" date,
	"completion_percentage" numeric(5, 2),
	"time_spent" integer
);
--> statement-breakpoint
CREATE TABLE "user_course_moodle_role" (
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"id_role" integer NOT NULL,
	"role_shortname" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_group" (
	"id_user" integer NOT NULL,
	"id_group" integer NOT NULL,
	"join_date" date,
	"completion_percentage" numeric(5, 2),
	"time_spent" integer,
	"last_access" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id_user" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"surname" text NOT NULL,
	"email" text NOT NULL,
	"moodle_username" text,
	"moodle_password" text,
	"moodle_id" integer,
	CONSTRAINT "users_moodle_id_unique" UNIQUE("moodle_id")
);
--> statement-breakpoint
ALTER TABLE "centers" ADD CONSTRAINT "centers_id_company_companies_id_company_fk" FOREIGN KEY ("id_company") REFERENCES "public"."companies"("id_company") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "public"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_group_groups_id_group_fk" FOREIGN KEY ("id_group") REFERENCES "public"."groups"("id_group") ON DELETE no action ON UPDATE no action;