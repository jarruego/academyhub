CREATE TYPE "academyhub"."candidate_attendance_status" AS ENUM('PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'SIN_RESPUESTA');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_documentation_status" AS ENUM('PENDIENTE', 'SOLICITADA', 'PARCIAL', 'COMPLETA', 'NO_APLICA');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_employment_status" AS ENUM('DESEMPLEO', 'OCUPADO', 'OTRO');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_followup_origin" AS ENUM('USUARIO', 'SISTEMA');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_followup_type" AS ENUM('LLAMADA', 'CORREO', 'CONFIRMACION_ASISTENCIA', 'SOLICITUD_DOCUMENTACION', 'DOCUMENTACION_RECIBIDA', 'CAMBIO_ESTADO', 'NOTA', 'RENUNCIA', 'IMPORTACION_SISTEMA');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_process_status" AS ENUM('NUEVA', 'EN_CONTACTO', 'PENDIENTE_SELECCION', 'SELECCIONADA', 'NO_SELECCIONADA', 'RENUNCIA', 'MATRICULADA', 'CERRADA');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_selection_status" AS ENUM('PENDIENTE', 'SELECCIONADO', 'NO_SELECCIONADO');--> statement-breakpoint
CREATE TYPE "academyhub"."candidate_source" AS ENUM('MANUAL', 'EXCEL_OPERATIVO', 'INTERES_CURSO', 'IMPORTACION_INAEM');--> statement-breakpoint
CREATE TYPE "academyhub"."preinscription_registration_source" AS ENUM('IMPORTACION_INAEM', 'CONFIRMACION_MANUAL');--> statement-breakpoint
CREATE TABLE "academyhub"."candidate_followups" (
	"id_followup" serial PRIMARY KEY NOT NULL,
	"id_candidate" integer NOT NULL,
	"event_type" "academyhub"."candidate_followup_type" NOT NULL,
	"note" text,
	"next_followup_at" timestamp with time zone,
	"origin" "academyhub"."candidate_followup_origin" DEFAULT 'USUARIO' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academyhub"."course_candidates" (
	"id_candidate" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"id_course" integer NOT NULL,
	"source" "academyhub"."candidate_source" DEFAULT 'MANUAL' NOT NULL,
	"process_status" "academyhub"."candidate_process_status" DEFAULT 'NUEVA' NOT NULL,
	"employment_status" "academyhub"."candidate_employment_status",
	"meets_requirements" boolean,
	"selection_status" "academyhub"."candidate_selection_status" DEFAULT 'PENDIENTE' NOT NULL,
	"attendance_status" "academyhub"."candidate_attendance_status" DEFAULT 'PENDIENTE' NOT NULL,
	"documentation_status" "academyhub"."candidate_documentation_status" DEFAULT 'PENDIENTE' NOT NULL,
	"operational_notes" text,
	"next_action" text,
	"next_followup_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"assigned_to" integer,
	"created_by" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academyhub"."user_preinscription" ADD COLUMN "registration_source" "academyhub"."preinscription_registration_source" DEFAULT 'IMPORTACION_INAEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."user_preinscription" ADD COLUMN "registered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "academyhub"."user_preinscription" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "academyhub"."user_preinscription" ADD COLUMN "verified_by" integer;--> statement-breakpoint
ALTER TABLE "academyhub"."user_preinscription" ADD COLUMN "last_imported_at" timestamp with time zone;--> statement-breakpoint
-- Toda preinscripción histórica del INAEM debe verse también en la nueva bandeja
-- operativa. La tabla oficial sigue siendo la fuente de verdad del registro INAEM.
INSERT INTO "academyhub"."course_candidates" (
	"id_user",
	"id_course",
	"source",
	"process_status",
	"selection_status"
)
SELECT
	"id_user",
	"id_course",
	'IMPORTACION_INAEM'::"academyhub"."candidate_source",
	CASE "status"::text
		WHEN 'MATRICULADO' THEN 'MATRICULADA'::"academyhub"."candidate_process_status"
		WHEN 'DESCARTADO' THEN 'NO_SELECCIONADA'::"academyhub"."candidate_process_status"
		WHEN 'BAJA' THEN 'RENUNCIA'::"academyhub"."candidate_process_status"
		ELSE 'NUEVA'::"academyhub"."candidate_process_status"
	END,
	CASE "status"::text
		WHEN 'MATRICULADO' THEN 'SELECCIONADO'::"academyhub"."candidate_selection_status"
		WHEN 'DESCARTADO' THEN 'NO_SELECCIONADO'::"academyhub"."candidate_selection_status"
		ELSE 'PENDIENTE'::"academyhub"."candidate_selection_status"
	END
FROM "academyhub"."user_preinscription"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "academyhub"."candidate_followups" ADD CONSTRAINT "candidate_followups_id_candidate_course_candidates_id_candidate_fk" FOREIGN KEY ("id_candidate") REFERENCES "academyhub"."course_candidates"("id_candidate") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."candidate_followups" ADD CONSTRAINT "candidate_followups_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD CONSTRAINT "course_candidates_id_user_users_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "academyhub"."users"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD CONSTRAINT "course_candidates_id_course_courses_id_course_fk" FOREIGN KEY ("id_course") REFERENCES "academyhub"."courses"("id_course") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD CONSTRAINT "course_candidates_assigned_to_auth_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academyhub"."course_candidates" ADD CONSTRAINT "course_candidates_created_by_auth_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_candidate_followups_id_candidate" ON "academyhub"."candidate_followups" USING btree ("id_candidate");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_course_candidates_user_course" ON "academyhub"."course_candidates" USING btree ("id_user","id_course");--> statement-breakpoint
CREATE INDEX "idx_course_candidates_id_course" ON "academyhub"."course_candidates" USING btree ("id_course");--> statement-breakpoint
CREATE INDEX "idx_course_candidates_process_status" ON "academyhub"."course_candidates" USING btree ("process_status");--> statement-breakpoint
CREATE INDEX "idx_course_candidates_assigned_to" ON "academyhub"."course_candidates" USING btree ("assigned_to");--> statement-breakpoint
ALTER TABLE "academyhub"."user_preinscription" ADD CONSTRAINT "user_preinscription_verified_by_auth_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "academyhub"."auth_users"("id") ON DELETE no action ON UPDATE no action;
