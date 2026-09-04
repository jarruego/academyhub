CREATE TYPE "academyhub"."course_catalog_status" AS ENUM('ACTIVO', 'INACTIVO', 'PENDIENTE_REVISION');
--> statement-breakpoint
CREATE TABLE "academyhub"."catalog_courses" (
	"id_catalog_course" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"internal_code" text,
	"description" text,
	"objectives" text,
	"base_contents" text,
	"default_modality" "academyhub"."course_modality",
	"default_hours" integer,
	"sepe_specialty_code" text,
	"sepe_specialty_name" text,
	"professional_family" text,
	"professional_area" text,
	"status" "academyhub"."course_catalog_status" DEFAULT 'ACTIVO' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_catalog_courses_normalized_name" ON "academyhub"."catalog_courses" USING btree ("normalized_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_catalog_courses_internal_code" ON "academyhub"."catalog_courses" USING btree ("internal_code");
--> statement-breakpoint
CREATE INDEX "idx_catalog_courses_status" ON "academyhub"."catalog_courses" USING btree ("status");
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "id_catalog_course" integer;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "capacity" integer;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "selection_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "selection_place" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "training_place" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "target_audience" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "admission_requirements" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "required_documentation" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "planned_schedule" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "coordinator" text;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "organization_notes" text;
--> statement-breakpoint
INSERT INTO "academyhub"."catalog_courses" ("name", "normalized_name", "status")
SELECT min(trim("course_name")), normalized_name, 'ACTIVO'::"academyhub"."course_catalog_status"
FROM (
	SELECT "course_name", upper(regexp_replace(trim(unaccent("course_name")), '\s+', ' ', 'g')) AS normalized_name
	FROM "academyhub"."courses"
) grouped_courses
GROUP BY normalized_name;
--> statement-breakpoint
UPDATE "academyhub"."courses" c
SET "id_catalog_course" = cc."id_catalog_course"
FROM "academyhub"."catalog_courses" cc
WHERE cc."normalized_name" = upper(regexp_replace(trim(unaccent(c."course_name")), '\s+', ' ', 'g'));
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ALTER COLUMN "id_catalog_course" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD CONSTRAINT "courses_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_courses_id_catalog_course" ON "academyhub"."courses" USING btree ("id_catalog_course");
