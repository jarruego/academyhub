DROP INDEX "academyhub"."idx_consulting_roster_adjustments_unique_center_user";--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" ADD COLUMN "year" integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_roster_adjustments_unique_center_user_year" ON "academyhub"."consulting_roster_adjustments" USING btree ("id_center","id_user","year");