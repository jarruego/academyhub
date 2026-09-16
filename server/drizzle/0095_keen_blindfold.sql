CREATE TABLE "academyhub"."consulting_competencies" (
	"id_competency" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_order" integer
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_competency_evaluations" (
	"id_competency_evaluation" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"id_center" integer NOT NULL,
	"id_competency" integer NOT NULL,
	"id_annual_engagement" integer NOT NULL,
	"value" boolean,
	"evaluated_at" timestamp DEFAULT now() NOT NULL,
	"evaluated_by" integer
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_job_position_aliases" (
	"id_job_position_alias" serial PRIMARY KEY NOT NULL,
	"job_position" text NOT NULL,
	"id_job_position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_job_positions" (
	"id_job_position" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_label" text,
	"display_order" integer
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_position_competency_templates" (
	"id_position_competency_template" serial PRIMARY KEY NOT NULL,
	"id_job_position" integer NOT NULL,
	"id_competency" integer NOT NULL,
	"default_value" boolean
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_competency_evaluations" ADD CONSTRAINT "consulting_competency_evaluations_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "academyhub"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_competency_evaluations" ADD CONSTRAINT "consulting_competency_evaluations_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_competency_evaluations" ADD CONSTRAINT "consulting_competency_evaluations_id_competency_consulting_competencies_id_competency_fk" FOREIGN KEY ("id_competency") REFERENCES "academyhub"."consulting_competencies"("id_competency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_competency_evaluations" ADD CONSTRAINT "consulting_competency_evaluations_id_annual_engagement_consulting_annual_engagements_id_annual_engagement_fk" FOREIGN KEY ("id_annual_engagement") REFERENCES "academyhub"."consulting_annual_engagements"("id_annual_engagement") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_competency_evaluations" ADD CONSTRAINT "consulting_competency_evaluations_evaluated_by_auth_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_job_position_aliases" ADD CONSTRAINT "consulting_job_position_aliases_id_job_position_consulting_job_positions_id_job_position_fk" FOREIGN KEY ("id_job_position") REFERENCES "academyhub"."consulting_job_positions"("id_job_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_position_competency_templates" ADD CONSTRAINT "consulting_position_competency_templates_id_job_position_consulting_job_positions_id_job_position_fk" FOREIGN KEY ("id_job_position") REFERENCES "academyhub"."consulting_job_positions"("id_job_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_position_competency_templates" ADD CONSTRAINT "consulting_position_competency_templates_id_competency_consulting_competencies_id_competency_fk" FOREIGN KEY ("id_competency") REFERENCES "academyhub"."consulting_competencies"("id_competency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_competency_evaluations_id_annual_engagement" ON "academyhub"."consulting_competency_evaluations" USING btree ("id_annual_engagement");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_competency_evaluations_unique" ON "academyhub"."consulting_competency_evaluations" USING btree ("id_user","id_center","id_competency","id_annual_engagement");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_job_position_aliases_unique_job_position" ON "academyhub"."consulting_job_position_aliases" USING btree ("job_position");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_position_competency_templates_unique_pair" ON "academyhub"."consulting_position_competency_templates" USING btree ("id_job_position","id_competency");