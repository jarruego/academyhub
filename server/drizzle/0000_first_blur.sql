DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_modality') THEN
    CREATE TYPE "public"."course_modality" AS ENUM('Online', 'Presencial', 'Mixta');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "auth_users" (
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

CREATE TABLE IF NOT EXISTS "centers" (
	"id_center" serial PRIMARY KEY NOT NULL,
	"center_name" varchar(128) NOT NULL,
	"employer_number" varchar(128),
	"id_company" integer NOT NULL,
	"contact_person" varchar(64),
	"contact_phone" varchar(32),
	"contact_email" varchar(128)
);

CREATE TABLE IF NOT EXISTS "companies" (
	"id_company" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(128) NOT NULL,
	"corporate_name" varchar(256) NOT NULL,
	"cif" varchar(12) NOT NULL,
	CONSTRAINT "companies_cif_unique" UNIQUE("cif")
);

CREATE TABLE IF NOT EXISTS "courses" (
	"id_course" serial PRIMARY KEY NOT NULL,
	"moodle_id" integer,
	"course_name" text NOT NULL,
	"category" text,
	"short_name" text NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"modality" "course_modality" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "groups" (
	"id_group" serial PRIMARY KEY NOT NULL,
	"moodle_id" integer,
	"group_name" text NOT NULL,
	"id_course" integer NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "groups_moodle_id_unique" UNIQUE("moodle_id")
);

CREATE TABLE IF NOT EXISTS "user_center" (
	"id_user" integer NOT NULL,
	"id_center" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	CONSTRAINT "user_center_id_user_id_center_pk" PRIMARY KEY("id_user","id_center")
);

CREATE TABLE IF NOT EXISTS "user_course" (
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"enrollment_date" date,
	"completion_percentage" numeric(5, 2),
	"time_spent" integer,
	CONSTRAINT "user_course_id_user_id_course_pk" PRIMARY KEY("id_user","id_course")
);

CREATE TABLE IF NOT EXISTS "user_course_moodle_role" (
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"id_role" integer NOT NULL,
	"role_shortname" text NOT NULL,
	CONSTRAINT "user_course_moodle_role_id_user_id_course_id_role_pk" PRIMARY KEY("id_user","id_course","id_role")
);

CREATE TABLE IF NOT EXISTS "user_group" (
	"id_user" integer NOT NULL,
	"id_group" integer NOT NULL,
	"id_center" integer,
	"join_date" date,
	"completion_percentage" numeric(5, 2),
	"time_spent" integer,
	"last_access" timestamp,
	CONSTRAINT "user_group_id_user_id_group_pk" PRIMARY KEY("id_user","id_group")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id_user" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_surname" text,
	"second_surname" text,
	"email" text,
	"moodle_username" text,
	"moodle_password" text,
	"moodle_id" integer,
	"dni" text,
	"phone" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_moodle_username_unique" UNIQUE("moodle_username"),
	CONSTRAINT "users_moodle_id_unique" UNIQUE("moodle_id"),
	CONSTRAINT "users_dni_unique" UNIQUE("dni")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'centers_id_company_companies_id_company_fk'
  ) THEN
    ALTER TABLE "centers" ADD CONSTRAINT "centers_id_company_companies_id_company_fk" FOREIGN KEY ("id_company") REFERENCES "public"."companies"("id_company") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'groups_id_course_courses_id_course_fk'
  ) THEN
    ALTER TABLE "groups" ADD CONSTRAINT "groups_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_center_id_user_users_id_user_fk'
  ) THEN
    ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_center_id_center_centers_id_center_fk'
  ) THEN
    ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "public"."centers"("id_center") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_course_id_user_users_id_user_fk'
  ) THEN
    ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_course_id_course_courses_id_course_fk'
  ) THEN
    ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_course_moodle_role_id_user_users_id_user_fk'
  ) THEN
    ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_course_moodle_role_id_course_courses_id_course_fk'
  ) THEN
    ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_group_id_user_users_id_user_fk'
  ) THEN
    ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_group_id_group_groups_id_group_fk'
  ) THEN
    ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_group_groups_id_group_fk" FOREIGN KEY ("id_group") REFERENCES "public"."groups"("id_group") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_group_id_center_centers_id_center_fk'
  ) THEN
    ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "public"."centers"("id_center") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;