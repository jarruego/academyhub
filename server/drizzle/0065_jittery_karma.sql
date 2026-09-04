CREATE TYPE "academyhub"."interest_source" AS ENUM('TELEFONO', 'WEB', 'PRESENCIAL', 'CENTRO', 'IMPORTACION', 'OTRO');--> statement-breakpoint
CREATE TYPE "academyhub"."interest_status" AS ENUM('INTERESADO', 'CONTACTADO', 'CONVOCADO', 'MATRICULADO', 'DESCARTADO', 'CERRADO');--> statement-breakpoint
CREATE TABLE "academyhub"."course_interests" (
	"id_interest" serial PRIMARY KEY NOT NULL,
	"id_catalog_course" integer NOT NULL,
	"id_user" integer NOT NULL,
	"status" "academyhub"."interest_status" DEFAULT 'INTERESADO' NOT NULL,
	"interest_date" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "academyhub"."interest_source",
	"preferred_modality" "academyhub"."course_modality",
	"availability" text,
	"notes" text,
	"assigned_to" integer,
	"created_by" integer,
	"closed_at" timestamp with time zone,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD COLUMN "id_interest" integer;--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ADD CONSTRAINT "course_interests_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ADD CONSTRAINT "course_interests_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "academyhub"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ADD CONSTRAINT "course_interests_assigned_to_auth_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ADD CONSTRAINT "course_interests_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_interests_catalog_course" ON "academyhub"."course_interests" USING btree ("id_catalog_course");--> statement-breakpoint
CREATE INDEX "idx_course_interests_id_user" ON "academyhub"."course_interests" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "idx_course_interests_status" ON "academyhub"."course_interests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_course_interests_assigned_to" ON "academyhub"."course_interests" USING btree ("assigned_to");--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD CONSTRAINT "course_candidates_id_interest_course_interests_id_interest_fk" FOREIGN KEY ("id_interest") REFERENCES "academyhub"."course_interests"("id_interest") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_candidates_id_interest" ON "academyhub"."course_candidates" USING btree ("id_interest");