CREATE TABLE "organization_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"center_id" integer NOT NULL,
	"settings" jsonb NOT NULL,
	"logo_path" text,
	"signature_path" text,
	"encrypted_secrets" jsonb,
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_center_id_centers_id_center_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id_center") ON DELETE no action ON UPDATE no action;