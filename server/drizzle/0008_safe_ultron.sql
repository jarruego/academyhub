ALTER TABLE "user_course_role" RENAME TO "user_course_moodle_role";--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" DROP CONSTRAINT "user_course_role_id_user_users_id_user_fk";
--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" DROP CONSTRAINT "user_course_role_id_course_courses_id_course_fk";
--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;