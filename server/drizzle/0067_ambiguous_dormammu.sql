DROP INDEX "academyhub"."idx_catalog_courses_status";--> statement-breakpoint
ALTER TABLE "academyhub"."catalog_courses" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "academyhub"."course_catalog_status";