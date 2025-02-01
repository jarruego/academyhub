ALTER TABLE "public"."courses" ALTER COLUMN "modality" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."course_modality";--> statement-breakpoint
CREATE TYPE "public"."course_modality" AS ENUM('Online', 'Presencial', 'Mixta');--> statement-breakpoint
ALTER TABLE "public"."courses" ALTER COLUMN "modality" SET DATA TYPE "public"."course_modality" USING "modality"::"public"."course_modality";