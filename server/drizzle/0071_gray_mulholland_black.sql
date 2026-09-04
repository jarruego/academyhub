ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "attendance_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "attendance_status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "academyhub"."course_candidates" SET "attendance_status" = CASE
  WHEN "attendance_status" = 'CONFIRMADA' THEN 'SI'
  WHEN "attendance_status" = 'RECHAZADA' THEN 'NO'
  WHEN "attendance_status" = 'SIN_RESPUESTA' THEN 'PENDIENTE'
  ELSE "attendance_status"
END;--> statement-breakpoint
DROP TYPE "academyhub"."candidate_attendance_status";--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_attendance_status" AS ENUM('PENDIENTE', 'SI', 'NO');--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "attendance_status" SET DATA TYPE "academyhub"."candidate_attendance_status" USING "attendance_status"::"academyhub"."candidate_attendance_status";--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ALTER COLUMN "attendance_status" SET DEFAULT 'PENDIENTE';
