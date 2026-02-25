CREATE TABLE "mail_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"is_html" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
DROP TABLE "scheduler_locks" CASCADE;