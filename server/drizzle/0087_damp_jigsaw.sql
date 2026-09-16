CREATE TABLE "academyhub"."consulting_plan_items" (
	"id_plan_item" serial PRIMARY KEY NOT NULL,
	"id_consulting_client" integer NOT NULL,
	"id_center" integer,
	"id_catalog_course" integer NOT NULL,
	"added_by" integer,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_plan_items" ADD CONSTRAINT "consulting_plan_items_id_consulting_client_consulting_clients_id_consulting_client_fk" FOREIGN KEY ("id_consulting_client") REFERENCES "academyhub"."consulting_clients"("id_consulting_client") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_plan_items" ADD CONSTRAINT "consulting_plan_items_id_center_centers_id_center_fk" FOREIGN KEY ("id_center") REFERENCES "academyhub"."centers"("id_center") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_plan_items" ADD CONSTRAINT "consulting_plan_items_id_catalog_course_catalog_courses_id_catalog_course_fk" FOREIGN KEY ("id_catalog_course") REFERENCES "academyhub"."catalog_courses"("id_catalog_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."consulting_plan_items" ADD CONSTRAINT "consulting_plan_items_added_by_auth_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consulting_plan_items_id_consulting_client" ON "academyhub"."consulting_plan_items" USING btree ("id_consulting_client");--> statement-breakpoint
CREATE INDEX "idx_consulting_plan_items_id_center" ON "academyhub"."consulting_plan_items" USING btree ("id_center");--> statement-breakpoint
CREATE INDEX "idx_consulting_plan_items_id_catalog_course" ON "academyhub"."consulting_plan_items" USING btree ("id_catalog_course");