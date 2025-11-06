CREATE TABLE "user_roles" (
	"id_role" serial PRIMARY KEY NOT NULL,
	"role_shortname" text NOT NULL,
	"role_description" text
);
--> statement-breakpoint
ALTER TABLE "user_group" ADD COLUMN "id_role" integer;--> statement-breakpoint
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_id_role_user_roles_id_role_fk" FOREIGN KEY ("id_role") REFERENCES "public"."user_roles"("id_role") ON DELETE no action ON UPDATE no action;