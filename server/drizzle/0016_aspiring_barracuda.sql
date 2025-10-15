CREATE TABLE "import_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_source" varchar(50) NOT NULL,
	"dni_csv" varchar(20),
	"name_csv" varchar(100),
	"first_surname_csv" varchar(100),
	"second_surname_csv" varchar(100),
	"name_db" varchar(100),
	"first_surname_db" varchar(100),
	"second_surname_db" varchar(100),
	"similarity_score" numeric(5, 4) NOT NULL,
	"csv_row_data" jsonb NOT NULL,
	"selected_user_id" integer,
	"processed" boolean DEFAULT false,
	"decision_action" varchar(20),
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar(50) NOT NULL,
	"import_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0,
	"processed_rows" integer DEFAULT 0,
	"error_message" varchar(500),
	"result_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	CONSTRAINT "import_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "import_decisions" ADD CONSTRAINT "import_decisions_selected_user_id_users_id_user_fk" FOREIGN KEY ("selected_user_id") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;