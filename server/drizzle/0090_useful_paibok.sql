CREATE TYPE "academyhub"."consulting_roster_adjustment_type" AS ENUM('ADD', 'REMOVE');--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_action_attendees" (
	"id_action_attendee" serial PRIMARY KEY NOT NULL,
	"id_catalog_course" integer NOT NULL,
	"id_center" integer NOT NULL,
	"id_user" integer NOT NULL,
	"created_by" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_roster_adjustments" (
	"id_roster_adjustment" serial PRIMARY KEY NOT NULL,
	"id_center" integer NOT NULL,
	"id_user" integer NOT NULL,
	"adjustment_type" "academyhub"."consulting_roster_adjustment_type" NOT NULL,
	"created_by" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_attendees" ADD CONSTRAINT "consulting_action_attendees_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_attendees" ADD CONSTRAINT "consulting_action_attendees_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_attendees" ADD CONSTRAINT "consulting_action_attendees_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "academyhub"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_attendees" ADD CONSTRAINT "consulting_action_attendees_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" ADD CONSTRAINT "consulting_roster_adjustments_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" ADD CONSTRAINT "consulting_roster_adjustments_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "academyhub"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_roster_adjustments" ADD CONSTRAINT "consulting_roster_adjustments_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_action_attendees_unique" ON "academyhub"."consulting_action_attendees" USING btree ("id_catalog_course","id_center","id_user");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_consulting_roster_adjustments_unique_center_user" ON "academyhub"."consulting_roster_adjustments" USING btree ("id_center","id_user");