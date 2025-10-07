ALTER TABLE "users" DROP CONSTRAINT "users_moodle_username_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_moodle_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "moodle_username";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "moodle_password";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "moodle_id";