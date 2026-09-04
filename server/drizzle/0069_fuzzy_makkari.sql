DROP TABLE IF EXISTS "academyhub"."candidate_followups" CASCADE;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD COLUMN IF NOT EXISTS "has_darde" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD COLUMN IF NOT EXISTS "has_dni" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD COLUMN IF NOT EXISTS "has_titulacion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP TYPE IF EXISTS "academyhub"."candidate_followup_origin";--> statement-breakpoint
DROP TYPE IF EXISTS "academyhub"."candidate_followup_type";
