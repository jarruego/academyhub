CREATE TYPE "public"."course_origin" AS ENUM('CLIENTE', 'INAEM', 'PRIVADO', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."preinscription_status" AS ENUM('PREINSCRITO', 'MATRICULADO', 'DESCARTADO', 'BAJA');--> statement-breakpoint
CREATE TABLE "user_preinscription" (
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"status" "preinscription_status" DEFAULT 'PREINSCRITO' NOT NULL,
	"prioritaria" boolean DEFAULT false NOT NULL,
	"preinscription_date" date,
	CONSTRAINT "user_preinscription_id_user_id_course_pk" PRIMARY KEY("id_user","id_course")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "file_number" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "origin" "course_origin";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "is_provisional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_group" ADD COLUMN "finalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preinscription" ADD CONSTRAINT "user_preinscription_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preinscription" ADD CONSTRAINT "user_preinscription_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "public"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_preinscription_id_course" ON "user_preinscription" USING btree ("id_course");--> statement-breakpoint
CREATE INDEX "idx_courses_file_number" ON "courses" USING btree ("file_number");