ALTER TABLE "academyhub"."catalog_courses" ADD COLUMN "short_name" text;
UPDATE "academyhub"."catalog_courses" SET "short_name" = "name" WHERE "short_name" IS NULL;
ALTER TABLE "academyhub"."catalog_courses" ALTER COLUMN "short_name" SET NOT NULL;
