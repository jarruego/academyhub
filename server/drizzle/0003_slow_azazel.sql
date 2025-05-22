ALTER TABLE "users" ADD COLUMN "registration_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nss" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_nss_unique" UNIQUE("nss");