CREATE TABLE "moodle_users" (
	"id_moodle_user" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"moodle_id" integer NOT NULL,
	"moodle_username" text NOT NULL,
	"moodle_password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "moodle_users_moodle_id_unique" UNIQUE("moodle_id"),
	CONSTRAINT "moodle_users_moodle_username_unique" UNIQUE("moodle_username")
);
--> statement-breakpoint
ALTER TABLE "user_course" ADD COLUMN "id_moodle_user" integer;--> statement-breakpoint
ALTER TABLE "moodle_users" ADD CONSTRAINT "moodle_users_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course" ADD CONSTRAINT "user_course_id_moodle_user_moodle_users_id_moodle_user_fk" FOREIGN KEY ("id_moodle_user") REFERENCES "public"."moodle_users"("id_moodle_user") ON DELETE no action ON UPDATE no action;