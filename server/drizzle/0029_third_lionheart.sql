CREATE TABLE "scheduler_locks" (
	"lock_key" varchar(255) PRIMARY KEY NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_scheduler_locks_expires_at" ON "scheduler_locks" USING btree ("expires_at");