ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_user_id_center_pk" PRIMARY KEY("id_user","id_center");--> statement-breakpoint
ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_user_id_course_pk" PRIMARY KEY("id_user","id_course");--> statement-breakpoint
ALTER TABLE "user_course_moodle_role" ADD CONSTRAINT "user_course_moodle_role_id_user_id_course_id_role_pk" PRIMARY KEY("id_user","id_course","id_role");--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_user_id_group_pk" PRIMARY KEY("id_user","id_group");