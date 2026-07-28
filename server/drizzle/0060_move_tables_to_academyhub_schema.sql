-- Custom SQL migration file, put your code below! --
-- Mueve todas las tablas y tipos enum de "public" a un schema propio "academyhub".
-- Las secuencias de las columnas serial/identity son propiedad de su tabla y Postgres
-- las mueve automáticamente junto con ella (no requieren ALTER SEQUENCE aparte).

CREATE SCHEMA IF NOT EXISTS academyhub;

ALTER TABLE public.auth_users SET SCHEMA academyhub;
ALTER TABLE public.centers SET SCHEMA academyhub;
ALTER TABLE public.audit_log SET SCHEMA academyhub;
ALTER TABLE public.email_log SET SCHEMA academyhub;
ALTER TABLE public.import_decisions SET SCHEMA academyhub;
ALTER TABLE public.failed_user_imports SET SCHEMA academyhub;
ALTER TABLE public.groups SET SCHEMA academyhub;
ALTER TABLE public.companies SET SCHEMA academyhub;
ALTER TABLE public.course_requests SET SCHEMA academyhub;
ALTER TABLE public.courses SET SCHEMA academyhub;
ALTER TABLE public.moodle_protected_user SET SCHEMA academyhub;
ALTER TABLE public.moodle_user_auth_user SET SCHEMA academyhub;
ALTER TABLE public.mail_templates SET SCHEMA academyhub;
ALTER TABLE public.moodle_audit_snapshot SET SCHEMA academyhub;
ALTER TABLE public.revoked_tokens SET SCHEMA academyhub;
ALTER TABLE public.user_center SET SCHEMA academyhub;
ALTER TABLE public.user_roles SET SCHEMA academyhub;
ALTER TABLE public.organization_settings SET SCHEMA academyhub;
ALTER TABLE public.user_course SET SCHEMA academyhub;
ALTER TABLE public.user_group SET SCHEMA academyhub;
ALTER TABLE public.user_preinscription SET SCHEMA academyhub;
ALTER TABLE public.users SET SCHEMA academyhub;
ALTER TABLE public.moodle_users SET SCHEMA academyhub;
ALTER TABLE public.smtp_settings SET SCHEMA academyhub;
ALTER TABLE public.course_request_students SET SCHEMA academyhub;
ALTER TABLE public.import_jobs SET SCHEMA academyhub;

ALTER TYPE public.course_client SET SCHEMA academyhub;
ALTER TYPE public.course_funding SET SCHEMA academyhub;
ALTER TYPE public.course_modality SET SCHEMA academyhub;
ALTER TYPE public.course_request_source SET SCHEMA academyhub;
ALTER TYPE public.course_request_status SET SCHEMA academyhub;
ALTER TYPE public.document_type SET SCHEMA academyhub;
ALTER TYPE public.gender SET SCHEMA academyhub;
ALTER TYPE public.group_active_mode SET SCHEMA academyhub;
ALTER TYPE public.preinscription_status SET SCHEMA academyhub;
