ALTER TABLE "groups" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "end_date";--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_moodle_id_unique" UNIQUE("moodle_id");