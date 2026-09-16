CREATE TABLE "academyhub"."consulting_job_position_groups" (
	"id_job_position_group" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_order" integer
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_job_positions" ADD COLUMN "id_job_position_group" integer;--> statement-breakpoint
-- Migra los grupos ya en uso (texto libre) a filas reales de la tabla nueva,
-- y engancha cada puesto a su grupo por FK antes de tirar la columna vieja.
INSERT INTO "academyhub"."consulting_job_position_groups" ("name")
SELECT DISTINCT "group_label" FROM "academyhub"."consulting_job_positions" WHERE "group_label" IS NOT NULL;--> statement-breakpoint
UPDATE "academyhub"."consulting_job_positions" AS p
SET "id_job_position_group" = g."id_job_position_group"
FROM "academyhub"."consulting_job_position_groups" AS g
WHERE g."name" = p."group_label";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_job_position_groups_unique_name" ON "academyhub"."consulting_job_position_groups" USING btree ("name");--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_job_positions" ADD CONSTRAINT "consulting_job_positions_id_job_position_group_consulting_job_position_groups_id_job_position_group_fk" FOREIGN KEY ("id_job_position_group") REFERENCES "academyhub"."consulting_job_position_groups"("id_job_position_group") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_job_positions" DROP COLUMN "group_label";