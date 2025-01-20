CREATE TABLE "user_group" (
	"id_user_group" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"id_group" integer NOT NULL,
	"join_date" date,
	"completion_percentage" numeric(5, 2),
	"time_spent" integer,
	"last_access" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_group_groups_id_group_fk" FOREIGN KEY ("id_group") REFERENCES "public"."groups"("id_group") ON DELETE no action ON UPDATE no action;