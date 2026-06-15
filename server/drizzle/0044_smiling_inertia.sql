CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_username" varchar(64),
	"actor_role" varchar(16),
	"method" varchar(10),
	"path" text,
	"target" text,
	"status_code" integer,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");