ALTER TABLE "academyhub"."consulting_action_details" DROP CONSTRAINT "consulting_action_details_id_course_courses_id_course_fk";
--> statement-breakpoint
ALTER TABLE "academyhub"."catalog_courses" ADD COLUMN "target_audience" text;--> statement-breakpoint
-- Tabla vacía y sin usar todavía (creada en esta misma sesión): se reordena a
-- mano para borrar la PK vieja (id_course) antes de crear la nueva
-- (id_catalog_course) — Postgres no admite dos PRIMARY KEY a la vez, y
-- drizzle-kit generó el ADD antes que el DROP.
ALTER TABLE "academyhub"."consulting_action_details" DROP COLUMN "id_course";--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" DROP COLUMN "objectives";--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" ADD COLUMN "id_catalog_course" integer PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" ADD CONSTRAINT "consulting_action_details_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;