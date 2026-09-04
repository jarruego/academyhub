ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "academyhub"."course_candidates" SET "process_status" = CASE
  WHEN "process_status" IN ('NUEVA', 'EN_CONTACTO', 'PENDIENTE_SELECCION') THEN 'PENDIENTE'
  WHEN "process_status" = 'MATRICULADA' THEN 'SELECCIONADA'
  WHEN "process_status" IN ('RENUNCIA', 'CERRADA') THEN 'NO_SELECCIONADA'
  ELSE "process_status"
END;--> statement-breakpoint
DROP TYPE "academyhub"."candidate_process_status";--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_process_status" AS ENUM('PENDIENTE', 'SELECCIONADA', 'NO_SELECCIONADA');--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" SET DATA TYPE "academyhub"."candidate_process_status" USING "process_status"::"academyhub"."candidate_process_status";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "process_status" SET DEFAULT 'PENDIENTE';
