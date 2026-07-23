CREATE TYPE "public"."course_request_source" AS ENUM('EXCEL', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."course_request_status" AS ENUM('ABIERTA', 'CERRADA');--> statement-breakpoint
CREATE TABLE "course_request_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_request" integer NOT NULL,
	"row_order" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"first_surname" text NOT NULL,
	"second_surname" text,
	"dni" text NOT NULL,
	"email" text NOT NULL,
	"phone_mobile" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_requests" (
	"id_request" serial PRIMARY KEY NOT NULL,
	"id_center" integer,
	"id_course" integer NOT NULL,
	"contact_email" text,
	"status" "course_request_status" DEFAULT 'ABIERTA' NOT NULL,
	"source" "course_request_source" DEFAULT 'MANUAL' NOT NULL,
	"notes" text,
	"created_by" integer,
	"closed_at" timestamp with time zone,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_request_students" ADD CONSTRAINT "course_request_students_id_request_course_requests_id_request_fk" FOREIGN KEY ("id_request") REFERENCES "public"."course_requests"("id_request") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "public"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_requests" ADD CONSTRAINT "course_requests_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_request_students_id_request" ON "course_request_students" USING btree ("id_request");--> statement-breakpoint
CREATE INDEX "idx_course_requests_id_course" ON "course_requests" USING btree ("id_course");--> statement-breakpoint
CREATE INDEX "idx_course_requests_id_center" ON "course_requests" USING btree ("id_center");--> statement-breakpoint
CREATE INDEX "idx_course_requests_status" ON "course_requests" USING btree ("status");