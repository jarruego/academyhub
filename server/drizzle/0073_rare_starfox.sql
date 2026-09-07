ALTER TABLE "academyhub"."course_requests" ADD COLUMN "id_catalog_course" integer;--> statement-breakpoint
ALTER TABLE "academyhub"."course_requests" ADD CONSTRAINT "course_requests_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_requests_id_catalog_course" ON "academyhub"."course_requests" USING btree ("id_catalog_course");--> statement-breakpoint
-- Backfill: las peticiones existentes apuntaban a una edición concreta
-- (id_course); se deriva el curso de catálogo desde esa edición para no
-- perder la asociación al pasar el modelo a nivel de catálogo.
UPDATE "academyhub"."course_requests" cr
SET "id_catalog_course" = c."id_catalog_course"
FROM "academyhub"."courses" c
WHERE c."id_course" = cr."id_course";