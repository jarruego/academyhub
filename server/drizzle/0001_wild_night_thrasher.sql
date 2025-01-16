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
ALTER TABLE "groups" ADD CONSTRAINT "groups_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;