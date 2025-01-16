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
