CREATE TYPE "academyhub"."consulting_engagement_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_annual_engagements" (
	"id_annual_engagement" serial PRIMARY KEY NOT NULL,
	"id_consulting_client" integer NOT NULL,
	"year" integer NOT NULL,
	"status" "academyhub"."consulting_engagement_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_engagement_centers" (
	"id_engagement_center" serial PRIMARY KEY NOT NULL,
	"id_annual_engagement" integer NOT NULL,
	"id_center" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_annual_audits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- DROP TABLE ... CASCADE ya elimina la FK de consulting_action_evaluations que la
-- referenciaba (consulting_action_evaluations_id_annual_audit_..._fk) — un DROP
-- CONSTRAINT explícito después fallaría con "no existe". Ver docs/architecture.md
-- (mismo tipo de bug de orden ya visto en la migración 0085).
DROP TABLE "academyhub"."consulting_annual_audits" CASCADE;--> statement-breakpoint
-- Fila(s) de prueba de esta misma sesión de desarrollo, huérfanas tras el
-- DROP TABLE de arriba (sin auditoría a la que apuntar) — se borran antes de
-- añadir la nueva columna NOT NULL sin default. Solo entorno de desarrollo.
DELETE FROM "academyhub"."consulting_action_evaluations";--> statement-breakpoint
DROP INDEX "academyhub"."idx_consulting_action_evaluations_id_annual_audit";--> statement-breakpoint
DROP INDEX "academyhub"."idx_consulting_roster_adjustments_unique_center_user_year";--> statement-breakpoint
DROP INDEX "academyhub"."idx_consulting_action_attendees_unique";--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_attendees" ADD COLUMN "id_annual_engagement" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" ADD COLUMN "id_annual_engagement" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" ADD COLUMN "id_annual_engagement" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_annual_engagements" ADD CONSTRAINT "consulting_annual_engagements_id_consulting_client_consulting_clients_id_consulting_client_fk" FOREIGN KEY ("id_consulting_client") REFERENCES "academyhub"."consulting_clients"("id_consulting_client") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_annual_engagements" ADD CONSTRAINT "consulting_annual_engagements_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_engagement_centers" ADD CONSTRAINT "consulting_engagement_centers_id_annual_engagement_consulting_annual_engagements_id_annual_engagement_fk" FOREIGN KEY ("id_annual_engagement") REFERENCES "academyhub"."consulting_annual_engagements"("id_annual_engagement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_engagement_centers" ADD CONSTRAINT "consulting_engagement_centers_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_annual_engagements_id_consulting_client" ON "academyhub"."consulting_annual_engagements" USING btree ("id_consulting_client");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_annual_engagements_unique_client_year" ON "academyhub"."consulting_annual_engagements" USING btree ("id_consulting_client","year");--> statement-breakpoint
CREATE INDEX "idx_consulting_engagement_centers_id_annual_engagement" ON "academyhub"."consulting_engagement_centers" USING btree ("id_annual_engagement");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_engagement_centers_unique_pair" ON "academyhub"."consulting_engagement_centers" USING btree ("id_annual_engagement","id_center");--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_attendees" ADD CONSTRAINT "consulting_action_attendees_id_annual_engagement_consulting_annual_engagements_id_annual_engagement_fk" FOREIGN KEY ("id_annual_engagement") REFERENCES "academyhub"."consulting_annual_engagements"("id_annual_engagement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" ADD CONSTRAINT "consulting_action_evaluations_id_annual_engagement_consulting_annual_engagements_id_annual_engagement_fk" FOREIGN KEY ("id_annual_engagement") REFERENCES "academyhub"."consulting_annual_engagements"("id_annual_engagement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" ADD CONSTRAINT "consulting_roster_adjustments_id_annual_engagement_consulting_annual_engagements_id_annual_engagement_fk" FOREIGN KEY ("id_annual_engagement") REFERENCES "academyhub"."consulting_annual_engagements"("id_annual_engagement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_action_evaluations_id_annual_engagement" ON "academyhub"."consulting_action_evaluations" USING btree ("id_annual_engagement");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_roster_adjustments_unique" ON "academyhub"."consulting_roster_adjustments" USING btree ("id_center","id_user","id_annual_engagement");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_action_attendees_unique" ON "academyhub"."consulting_action_attendees" USING btree ("id_catalog_course","id_center","id_annual_engagement","id_user");--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" DROP COLUMN "id_annual_audit";--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" DROP COLUMN "year";--> statement-breakpoint
DROP TYPE "academyhub"."consulting_annual_audit_status";