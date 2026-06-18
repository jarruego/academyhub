DROP INDEX "idx_courses_file_number";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_courses_file_number" ON "courses" USING btree ("file_number");