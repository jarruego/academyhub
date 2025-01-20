CREATE TYPE "public"."enrollment_status" AS ENUM('Active', 'Completed', 'Dropped');--> statement-breakpoint
CREATE TABLE "user_course" (
	"id_user_course" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"enrollment_date" date,
	"status" "enrollment_status",
	"completion_percentage" numeric(5, 2),
	"time_spent" integer
);
--> statement-breakpoint
ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;