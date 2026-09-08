ALTER TABLE "academyhub"."catalog_courses" ADD COLUMN "contents" text;--> statement-breakpoint
-- Backfill: cada curso de catálogo hereda el contenido de su edición más
-- reciente (start_date desc, luego id_course desc) que tenga `contents` no
-- vacío. Los catálogos sin ninguna edición con contenidos quedan en NULL.
UPDATE "academyhub"."catalog_courses" cc
SET "contents" = sub.contents
FROM (
	SELECT DISTINCT ON (c.id_catalog_course) c.id_catalog_course, c.contents
	FROM "academyhub"."courses" c
	WHERE c.contents IS NOT NULL AND btrim(c.contents) <> ''
	ORDER BY c.id_catalog_course, c.start_date DESC NULLS LAST, c.id_course DESC
) sub
WHERE sub.id_catalog_course = cc.id_catalog_course;