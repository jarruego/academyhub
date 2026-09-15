CREATE TABLE "academyhub"."course_categories" (
	"id_category" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD COLUMN "id_category" integer;--> statement-breakpoint
ALTER TABLE "academyhub"."courses" ADD CONSTRAINT "courses_id_category_course_categories_id_category_fk" FOREIGN KEY ("id_category") REFERENCES "academyhub"."course_categories"("id_category") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_courses_id_category" ON "academyhub"."courses" USING btree ("id_category");--> statement-breakpoint
ALTER TABLE "academyhub"."courses" DROP COLUMN "category";