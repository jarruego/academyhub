ALTER TABLE "courses" ADD COLUMN "moodle_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "moodle_synced_at" timestamp with time zone;