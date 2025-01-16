ALTER TABLE "users" ADD CONSTRAINT "users_dni_unique" UNIQUE("dni");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_moodle_id_unique" UNIQUE("moodle_id");