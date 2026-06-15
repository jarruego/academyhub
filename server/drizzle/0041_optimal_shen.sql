CREATE INDEX "idx_centers_import_id" ON "centers" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "idx_centers_id_company" ON "centers" USING btree ("id_company");--> statement-breakpoint
CREATE INDEX "idx_companies_import_id" ON "companies" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "idx_import_decisions_processed" ON "import_decisions" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_import_decisions_dni_csv" ON "import_decisions" USING btree ("dni_csv");--> statement-breakpoint
CREATE INDEX "idx_moodle_users_id_user" ON "moodle_users" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "idx_user_center_id_center" ON "user_center" USING btree ("id_center");--> statement-breakpoint
CREATE INDEX "idx_user_course_id_course" ON "user_course" USING btree ("id_course");--> statement-breakpoint
CREATE INDEX "idx_user_group_id_group" ON "user_group" USING btree ("id_group");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");