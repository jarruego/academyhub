-- Idempotente: la tabla pudo crearse antes vía DDL en tiempo de ejecución (legacy).
CREATE TABLE IF NOT EXISTS "failed_user_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"dni" varchar(20),
	"name" varchar(100),
	"first_surname" varchar(100),
	"second_surname" varchar(100),
	"email" varchar(255),
	"import_id" varchar(50),
	"nss" varchar(20),
	"company_name" varchar(255),
	"center_name" varchar(255),
	"csv_row_data" jsonb NOT NULL,
	"failure_reason" text,
	"import_source" varchar(50) DEFAULT 'sage',
	"created_at" timestamp with time zone DEFAULT now()
);
