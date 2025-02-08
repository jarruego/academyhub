ALTER TABLE "users" ADD COLUMN "dni" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dni_unique" UNIQUE("dni");