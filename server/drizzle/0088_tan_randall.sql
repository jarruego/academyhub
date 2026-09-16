CREATE TYPE "academyhub"."consulting_annual_audit_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_annual_audits" (
	"id_annual_audit" serial PRIMARY KEY NOT NULL,
	"id_center" integer NOT NULL,
	"year" integer NOT NULL,
	"status" "academyhub"."consulting_annual_audit_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_annual_audits" ADD CONSTRAINT "consulting_annual_audits_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_annual_audits" ADD CONSTRAINT "consulting_annual_audits_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_annual_audits_id_center" ON "academyhub"."consulting_annual_audits" USING btree ("id_center");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_annual_audits_unique_center_year" ON "academyhub"."consulting_annual_audits" USING btree ("id_center","year");