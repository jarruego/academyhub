CREATE TABLE "moodle_audit_snapshot" (
	"kind" text PRIMARY KEY NOT NULL,
	"fetched_at" timestamp NOT NULL,
	"moodle_calls" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moodle_protected_user" (
	"moodle_id" integer PRIMARY KEY NOT NULL,
	"moodle_username" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
