CREATE TABLE "user_center" (
	"id_user_center" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"id_center" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date
);
--> statement-breakpoint
ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_center" ADD CONSTRAINT "user_center_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "public"."centers"("id_center") ON DELETE no action ON UPDATE no action;