# Server architecture

Read before adding modules, tables, repositories, or scheduler tasks.

## Module hierarchy
- `AppModule` — root, registers global `ThrottlerGuard` (120 req/min per IP), `AuthGuard` (JWT Bearer on all routes except `@Public()`), and `AuditInterceptor` (see `docs/security.md`). JSON body limit is 1 MB; file uploads use Multer (no limit shared).
- `DatabaseModule` — global, provides `DATABASE_PROVIDER` token (a `DatabaseService` wrapping a Drizzle + `pg.Pool` instance)
- `ApiModule` — aggregates all feature modules: Company, Center, Course, Group, User, AuthUser, Moodle, MoodleUser, ImportSage, ImportVelneo, Reports, Organization, Files, Mail, Audit, UserRoles
- `AuthModule` — login/logout endpoints, issues JWT; `auth_user` table is separate from the main `user` table
- `SchedulerModule` — internal cron scheduler using `node-cron`; each task implements `ScheduledTask` interface

## Three distinct user concepts
- **`auth_user`** — login credentials (`username`, `password` (scrypt+salt), `role`). Roles: `admin`, `manager`, `viewer`. Optionally holds a per-user `moodleToken` that overrides the org-level token.
- **`user`** — training domain users (students/employees). Linked to courses via `user_course`, to groups via `user_group`, to centers via `user_center`. Can optionally be linked to a `moodle_user` via `moodle_user_auth_user`.
- **`moodle_user`** — a Moodle platform user record, synced from Moodle. Its `id_user` FK references the `user` table (domain user), **not** `auth_user`. The `moodle_user_auth_user` table is a many-to-many bridge between `auth_user` and `moodle_user`; each row has its own `moodle_token` field.

## `user_roles` table
A lookup catalog of role definitions (`role_shortname`, `role_description`) used during Velneo imports to label roles within groups/courses. Not the same as `auth_user.role`.

## Database access pattern
All DB access goes through repositories in `server/src/database/repository/`. Each repository receives the `DATABASE_PROVIDER` injection token and calls `db.select(...)`, `db.insert(...)`, etc. using Drizzle ORM. Schema is defined in `server/src/database/schema/tables/*.table.ts` and re-exported from `server/src/database/schema.ts`.

The base `Repository` class (`src/database/repository/repository.ts`) exposes `dbService`, a `query()` method (uses an active transaction if one is passed), and a `transaction()` wrapper. Pass a transaction object through service calls to make multiple repository operations atomic.

Key junction tables: `user_center`, `user_course`, `user_group`, `moodle_user_auth_user`. (Note: the schema does NOT actually have an `organization_id` FK on domain tables — multi-tenancy is not implemented.)

## Drizzle migrations
Migration files live in `server/drizzle/`. After modifying any table file under `schema/tables/`, run `npm run db:generate` then `npm run db:migrate`. The `unaccent` and `pg_trgm` PostgreSQL extensions must exist before the first migration (requires superuser).

- `generate` only **creates a new migration file** + updates `drizzle/meta/` (journal + snapshot). It never rewrites past migrations and does not touch the DB.
- `migrate` applies pending migrations **in order** to the DB.
- When a table may already exist in production (created earlier outside migrations), hand-edit the generated `CREATE TABLE` to `CREATE TABLE IF NOT EXISTS` for idempotency (see `failed_user_imports`, migration `0043`).
- Watch for destructive statements (`DROP COLUMN` on a rename → data loss). Always read the generated `.sql` before `migrate`.

## Scheduler
Internal cron scheduler; tasks in `server/src/scheduler/tasks/`. Active tasks:
- `moodle-active-progress.task.ts` — syncs active course progress from Moodle
- `sage-import.task.ts` — automated SAGE CSV import from SFTP

Controlled via env vars:
- `ENABLE_CRON_SCHEDULER=true` — master switch
- `SAGE_IMPORT_ENABLED` / `SAGE_IMPORT_CRON` — SAGE CSV import (default: enabled, `0 2 * * *`)
- `MOODLE_ACTIVE_SYNC_ENABLED` / `MOODLE_ACTIVE_SYNC_CRON` — progress sync (default: disabled, `0 4 * * *`)
- Designed for single-instance deployments only

## Common utilities
- `src/utils/crypto/secrets.util.ts` — AES-256-GCM for org-level secrets (Moodle token) and string-column secrets (SMTP password): `encryptSecretToString`/`decryptSecretFromString`
- `src/utils/crypto/password-hashing.util.ts` — scrypt password hashing
- `src/common/pdf/pdf.service.ts` — shared PDF generation
- `src/common/storage/supabase-storage.service.ts` — Supabase Storage for mail template images
- `src/common/utils/dayjs-tz.ts` — timezone-aware date handling (used by scheduler and reports)
