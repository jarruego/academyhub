ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "academyhub"."course_candidates" SET "process_status" = 'DESCARTADA' WHERE "process_status" = 'NO_SELECCIONADA';--> statement-breakpoint
DROP TYPE "academyhub"."candidate_process_status";--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_process_status" AS ENUM('PENDIENTE', 'SELECCIONADA', 'RESERVA', 'BAJA', 'DESCARTADA');--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" SET DATA TYPE "academyhub"."candidate_process_status" USING "process_status"::"academyhub"."candidate_process_status";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" SET DEFAULT 'PENDIENTE';
