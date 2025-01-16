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
	"modality" text NOT NULL,
	"hours" integer NOT NULL,
	"price_per_hour" numeric(10, 2) NOT NULL,
	"active" boolean NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "centers" ADD CONSTRAINT "centers_id_company_companies_id_company_fk" FOREIGN KEY ("id_company") REFERENCES "public"."companies"("id_company") ON DELETE no action ON UPDATE no action;