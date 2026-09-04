ALTER TABLE "academyhub"."course_interests" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "academyhub"."interest_status";--> statement-breakpoint
CREATE TYPE "academyhub"."interest_status" AS ENUM('INTERESADO', 'CONTACTADO', 'CONVOCADO', 'MATRICULADO', 'DESCARTADO');--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ALTER COLUMN "status" SET DATA TYPE "academyhub"."interest_status" USING "status"::"academyhub"."interest_status";--> statement-breakpoint
ALTER TABLE "academyhub"."course_interests" ALTER COLUMN "status" SET DEFAULT 'INTERESADO';