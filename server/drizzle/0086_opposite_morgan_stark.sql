ALTER TABLE "academyhub"."courses" DROP CONSTRAINT "courses_id_category_course_categories_id_category_fk";
--> statement-breakpoint
DROP INDEX "academyhub"."idx_courses_id_category";--> statement-breakpoint
ALTER TABLE "academyhub"."courses" DROP COLUMN "id_category";