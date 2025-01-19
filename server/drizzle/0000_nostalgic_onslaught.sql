CREATE TYPE "public"."course_modality" AS ENUM('Online', 'Presential');--> statement-breakpoint
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
	"moodle_id" integer NOT NULL,
	"course_name" text NOT NULL,
	"category" text NOT NULL,
	"short_name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"fundae_id" text NOT NULL,
	"modality" "course_modality" NOT NULL,
	"hours" integer NOT NULL,
	"price_per_hour" numeric(10, 2) NOT NULL,
	"active" boolean NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id_group" serial PRIMARY KEY NOT NULL,
	"moodle_id" integer NOT NULL,
	"group_name" text NOT NULL,
	"id_course" integer NOT NULL,
	"description" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id_user" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"surname" text NOT NULL,
	"dni" text NOT NULL,
	"document_type" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"moodle_username" text,
	"moodle_password" text,
	"moodle_id" integer,
	"registration_date" date NOT NULL,
	"nss" text NOT NULL,
	"gender" text NOT NULL,
	"professional_category" text NOT NULL,
	"disability" boolean NOT NULL,
	"terrorism_victim" boolean NOT NULL,
	"gender_violence_victim" boolean NOT NULL,
	"education_level" text NOT NULL,
	"address" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"country" text NOT NULL,
	"observations" text NOT NULL,
	CONSTRAINT "users_dni_unique" UNIQUE("dni"),
	CONSTRAINT "users_moodle_id_unique" UNIQUE("moodle_id")
);
--> statement-breakpoint
ALTER TABLE "centers" ADD CONSTRAINT "centers_id_company_companies_id_company_fk" FOREIGN KEY ("id_company") REFERENCES "public"."companies"("id_company") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;