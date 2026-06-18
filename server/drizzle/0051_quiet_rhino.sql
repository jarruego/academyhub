-- Fase 1: separar origen (PRIVADA/INAEM) y financiación (PRIVADA/FUNDAE/PUBLICA).
-- Migración escrita a mano: la recreación de un pgEnum y el backfill no los genera
-- correctamente drizzle-kit (faltaba CREATE TYPE course_funding y el UPDATE de mapeo
-- de los valores antiguos de origin antes del cast de vuelta).

-- 1) Nuevo enum de financiación + columna (idempotente).
DO $$ BEGIN
  CREATE TYPE "public"."course_funding" AS ENUM('PRIVADA', 'FUNDAE', 'PUBLICA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "funding" "course_funding";--> statement-breakpoint

-- 2) Recrear el enum de origen con los nuevos valores.
--    Se castea a texto, se mapean los valores antiguos y se castea de vuelta.
ALTER TABLE "public"."courses" ALTER COLUMN "origin" SET DATA TYPE text;--> statement-breakpoint
UPDATE "courses" SET "origin" = 'PRIVADA' WHERE "origin" IN ('CLIENTE', 'PRIVADO', 'OTRO');--> statement-breakpoint
DROP TYPE "public"."course_origin";--> statement-breakpoint
CREATE TYPE "public"."course_origin" AS ENUM('PRIVADA', 'INAEM');--> statement-breakpoint
ALTER TABLE "public"."courses" ALTER COLUMN "origin" SET DATA TYPE "public"."course_origin" USING "origin"::"public"."course_origin";--> statement-breakpoint

-- 3) Backfill de financiación por reglas:
--    INAEM -> PUBLICA; con fundae_id -> FUNDAE; el resto -> PRIVADA.
UPDATE "courses" SET "funding" = 'PUBLICA' WHERE "funding" IS NULL AND "origin" = 'INAEM';--> statement-breakpoint
UPDATE "courses" SET "funding" = 'FUNDAE' WHERE "funding" IS NULL AND COALESCE("fundae_id", '') <> '';--> statement-breakpoint
UPDATE "courses" SET "funding" = 'PRIVADA' WHERE "funding" IS NULL;
