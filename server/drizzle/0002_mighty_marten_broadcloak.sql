ALTER TABLE "courses" ADD COLUMN "price_per_hour" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "fundae_id" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "active" boolean NOT NULL DEFAULT false;