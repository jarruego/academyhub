-- Sustituir el eje `origin` (PRIVADA/INAEM) por `client` (INAEM/VITALIA/OTRO).
-- El ámbito público/privado deja de almacenarse: se deriva de `funding`.
-- Migración escrita a mano (drizzle-kit no genera el backfill ni el orden correcto
-- de recreación de enums; además el rename origin->client es ambiguo para el generador).

-- 1) Nuevo enum de cliente + columna (idempotente).
DO $$ BEGIN
  CREATE TYPE "public"."course_client" AS ENUM('INAEM', 'VITALIA', 'OTRO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "client" "course_client";--> statement-breakpoint

-- 2) Backfill del cliente a partir del origen + financiación antiguos:
--    INAEM -> INAEM; PRIVADA bonificado (FUNDAE) -> VITALIA (heurística: ~95% de
--    FUNDAE es VITALIA, revisar excepciones a mano); resto de PRIVADA -> OTRO.
--    origin NULL se queda como client NULL ("sin clasificar").
UPDATE "courses" SET "client" = 'INAEM'   WHERE "client" IS NULL AND "origin" = 'INAEM';--> statement-breakpoint
UPDATE "courses" SET "client" = 'VITALIA' WHERE "client" IS NULL AND "origin" = 'PRIVADA' AND "funding" = 'FUNDAE';--> statement-breakpoint
UPDATE "courses" SET "client" = 'OTRO'    WHERE "client" IS NULL AND "origin" = 'PRIVADA';--> statement-breakpoint

-- 3) Eliminar la columna y el tipo de origen (ya no se usan).
ALTER TABLE "courses" DROP COLUMN IF EXISTS "origin";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."course_origin";
