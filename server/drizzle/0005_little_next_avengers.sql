ALTER TABLE "users" DROP CONSTRAINT "users_dni_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "dni";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "document_type";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "registration_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "nss";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "professional_category";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "disability";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "terrorism_victim";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "gender_violence_victim";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "education_level";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "postal_code";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "province";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "country";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "observations";--> statement-breakpoint
DROP TYPE "public"."document_type";--> statement-breakpoint
DROP TYPE "public"."gender";