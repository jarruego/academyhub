CREATE TYPE "academyhub"."consulting_action_origin" AS ENUM('OWN', 'EXTERNAL');--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_action_details" (
	"id_course" integer PRIMARY KEY NOT NULL,
	"origin" "academyhub"."consulting_action_origin" DEFAULT 'OWN' NOT NULL,
	"objectives" text,
	"id_category" integer,
	"id_planning_date" integer,
	"created_by" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academyhub"."consulting_planning_dates" (
	"id_planning_date" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" ADD CONSTRAINT "consulting_action_details_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "academyhub"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" ADD CONSTRAINT "consulting_action_details_id_category_course_categories_id_category_fk" FOREIGN KEY ("id_category") REFERENCES "academyhub"."course_categories"("id_category") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" ADD CONSTRAINT "consulting_action_details_id_planning_date_consulting_planning_dates_id_planning_date_fk" FOREIGN KEY ("id_planning_date") REFERENCES "academyhub"."consulting_planning_dates"("id_planning_date") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_action_details" ADD CONSTRAINT "consulting_action_details_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;