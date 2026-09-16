-- Columna nueva, sin default: se añade nullable, se rellenan las filas
-- existentes (solo entorno de desarrollo, única consultoría abierta hoy) y
-- luego se marca NOT NULL — igual que en la migración 0093.
ALTER TABLE "academyhub"."consulting_plan_items" ADD COLUMN "id_annual_engagement" integer;--> statement-breakpoint
UPDATE "academyhub"."consulting_plan_items" SET "id_annual_engagement" = (SELECT "id_annual_engagement" FROM "academyhub"."consulting_annual_engagements" ORDER BY "id_annual_engagement" LIMIT 1) WHERE "id_annual_engagement" IS NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_plan_items" ALTER COLUMN "id_annual_engagement" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_plan_items" ADD CONSTRAINT "consulting_plan_items_id_annual_engagement_consulting_annual_engagements_id_annual_engagement_fk" FOREIGN KEY ("id_annual_engagement") REFERENCES "academyhub"."consulting_annual_engagements"("id_annual_engagement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_plan_items_id_annual_engagement" ON "academyhub"."consulting_plan_items" USING btree ("id_annual_engagement");