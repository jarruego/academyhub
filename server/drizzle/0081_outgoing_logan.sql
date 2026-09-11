CREATE TABLE "academyhub"."sms_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_username" varchar(64),
	"actor_role" varchar(16),
	"recipient" varchar(32),
	"template_id" integer,
	"template_name" varchar(128),
	"sender_name" varchar(64),
	"mailrelay_id" integer,
	"status" varchar(16) NOT NULL,
	"error_message" text,
	"mailrelay_status" varchar(16),
	"mailrelay_status_checked_at" timestamp with time zone,
	"parts_count" integer,
	"used_credits" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "academyhub"."sms_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"account_url" varchar(255) NOT NULL,
	"api_key" text NOT NULL,
	"sender_name" varchar(20) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academyhub"."sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sms_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "idx_sms_log_created_at" ON "academyhub"."sms_log" USING btree ("created_at");