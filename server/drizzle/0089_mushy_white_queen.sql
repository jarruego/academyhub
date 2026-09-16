CREATE TABLE "academyhub"."consulting_action_evaluations" (
	"id_action_evaluation" serial PRIMARY KEY NOT NULL,
	"id_catalog_course" integer NOT NULL,
	"id_center" integer NOT NULL,
	"id_annual_audit" integer NOT NULL,
	"evaluation_date" timestamp NOT NULL,
	"evaluation_text" text,
	"percentage" integer,
	"imparte_text" text,
	"evaluated_by" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" ADD CONSTRAINT "consulting_action_evaluations_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" ADD CONSTRAINT "consulting_action_evaluations_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" ADD CONSTRAINT "consulting_action_evaluations_id_annual_audit_consulting_annual_audits_id_annual_audit_fk" FOREIGN KEY ("id_annual_audit") REFERENCES "academyhub"."consulting_annual_audits"("id_annual_audit") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_evaluations" ADD CONSTRAINT "consulting_action_evaluations_evaluated_by_auth_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_action_evaluations_id_catalog_course" ON "academyhub"."consulting_action_evaluations" USING btree ("id_catalog_course");--> statement-breakpoint
CREATE INDEX "idx_consulting_action_evaluations_id_center" ON "academyhub"."consulting_action_evaluations" USING btree ("id_center");--> statement-breakpoint
CREATE INDEX "idx_consulting_action_evaluations_id_annual_audit" ON "academyhub"."consulting_action_evaluations" USING btree ("id_annual_audit");