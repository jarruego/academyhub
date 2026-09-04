ALTER TABLE "academyhub"."course_candidates" DROP COLUMN IF EXISTS "selection_status";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" DROP COLUMN IF EXISTS "documentation_status";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" DROP COLUMN IF EXISTS "next_action";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" DROP COLUMN IF EXISTS "next_followup_at";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" DROP COLUMN IF EXISTS "last_contact_at";--> statement-breakpoint
DROP TYPE IF EXISTS "academyhub"."candidate_documentation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "academyhub"."candidate_selection_status";
