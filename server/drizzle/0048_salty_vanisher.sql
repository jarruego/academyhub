CREATE TYPE "public"."group_active_mode" AS ENUM('auto', 'active', 'inactive');--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "active" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "active_mode" "group_active_mode" DEFAULT 'auto' NOT NULL;