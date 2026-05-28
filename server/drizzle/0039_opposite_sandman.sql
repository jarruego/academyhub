CREATE TABLE "moodle_user_auth_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_moodle_user" integer NOT NULL,
	"id_auth_user" integer NOT NULL,
	"moodle_token" varchar(128) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moodle_user_auth_user" ADD CONSTRAINT "moodle_user_auth_user_id_moodle_user_moodle_users_id_moodle_user_fk" FOREIGN KEY ("id_moodle_user") REFERENCES "public"."moodle_users"("id_moodle_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moodle_user_auth_user" ADD CONSTRAINT "moodle_user_auth_user_id_auth_user_auth_users_id_fk" FOREIGN KEY ("id_auth_user") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;