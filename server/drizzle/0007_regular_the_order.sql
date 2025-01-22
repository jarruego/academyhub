CREATE TABLE "user_course_role" (
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"id_role" integer NOT NULL,
	"role_shortname" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_course_role" ADD CONSTRAINT "user_course_role_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_role" ADD CONSTRAINT "user_course_role_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;