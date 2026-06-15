CREATE TABLE "email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_username" varchar(64),
	"actor_role" varchar(16),
	"recipient" text,
	"subject" text,
	"template_id" integer,
	"template_name" varchar(128),
	"sender_mode" varchar(16),
	"from_name" varchar(255),
	"via_moodle" boolean DEFAULT false,
	"status" varchar(16) NOT NULL,
	"error_message" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_email_log_created_at" ON "email_log" USING btree ("created_at");