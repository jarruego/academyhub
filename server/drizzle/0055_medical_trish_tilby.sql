ALTER TABLE "moodle_users" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "moodle_users" ADD COLUMN "deleted_in_moodle_at" timestamp;