ALTER TABLE "academyhub"."course_requests" DROP CONSTRAINT "course_requests_id_course_courses_id_course_fk";
--> statement-breakpoint
DROP INDEX "academyhub"."idx_course_requests_id_course";--> statement-breakpoint
ALTER TABLE "academyhub"."course_requests" DROP COLUMN "id_course";