# Moodle integration & Mail

Read before touching `api/moodle/`, `api/mail/`, or notification/token logic.

## Moodle integration
`MoodleService` (`server/src/api/moodle/moodle.service.ts`) wraps all Moodle Web Services calls. The org-level Moodle token is stored encrypted in `organization_settings` (via `secrets.util.ts`) and can be overridden per `auth_user.moodleToken`. The optional custom plugin `block_advanced_reports_get_userstats` is gated by `organization_settings.settings.plugins.itop_training` — when enabled, it syncs `time_spent` and uses custom endpoints when creating users. The other plugin flags (`configurable_reports`, `certificates`, `progress_bar`) are declared in settings but currently unused by the code.

`moodle_users.moodle_password` is stored in plaintext on purpose (shown to users) — see `docs/security.md`.

## Token resolution
`process.env.MOODLE_TOKEN` is a legacy fallback that may not be set in production. The real org-level token lives in `organization_settings.encrypted_secrets`, read via `MoodleService.resolveMoodleToken()`. `MailService.resolveToken()` implements the full priority chain for notifications:
1. `moodle_user_auth_user.moodle_token` — link-specific token for the `auth_user`+`moodle_user` pair (highest `id` wins if several)
2. `auth_user.moodleToken` — per-authenticated-user fallback
3. `MoodleService.resolveMoodleToken()` — org-level token (default when `moodleSenderChoice = 'default'`)

Only implemented in `MailService.resolveToken()` — other call sites must replicate it manually; no shared helper exists yet.

The Moodle **URL** resolves with priority: DB `encrypted_secrets.moodle_url` → `settings.moodle.url` → `process.env.MOODLE_URL`.

## Active courses & groups (daily sync gate)

The authoritative "active" state lives at the **group** level and is resolved by `groupActiveCondition()` (`server/src/utils/group-active.util.ts`, SQL) with a client mirror `isGroupActive()` (`client/src/utils/group-active.util.ts`, TS) — **keep both in sync**. Resolution order:
1. `groups.active_mode = 'active'` → active (manual override).
2. `groups.active_mode = 'inactive'` → inactive (manual override).
3. `groups.active_mode = 'auto'` (default) → active only if `start_date` **and** `end_date` are set and `NOW()` ∈ `[start_date, end_date + ACTIVE_GROUP_GRACE_DAYS]`. Missing either date ⇒ inactive.

`ACTIVE_GROUP_GRACE_DAYS = 2` is a code constant (no env var); the client constant mirrors it. **Group dates are local metadata, not provided by Moodle** (`upsertMoodleGroup` only syncs name/description) — they must be maintained in the group form or via SAGE, otherwise an `auto` group is never active.

- **Daily sync**: `MoodleActiveProgressTask` → `getActiveCoursesProgress()` → `groupRepository.findActiveGroupsWithCourse()` syncs progress **only for active groups**. Gated by `MOODLE_ACTIVE_SYNC_ENABLED` (default false), cron `MOODLE_ACTIVE_SYNC_CRON` (default `0 4 * * *`).
- **Course active = derived**: a course is active iff it has ≥1 active group. The legacy `courses.active` boolean is no longer the source of truth: the Moodle import no longer forces it to `true`, the course form shows a read-only derived tag, and `user-course.repository` computes `course.active` via an EXISTS-active-group subquery. The client course/group lists compute the tag from `isGroupActive`.
- Override is editable per group via `active_mode` (group form / `CreateGroupDTO`/`UpdateGroupDTO`).

## Mail system
Mail templates are stored in the database (`mail_templates` table). Template images are stored in Supabase Storage (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` env vars). `MailService` sends Moodle notifications using the token resolution chain above.

`POST /mail/send` and `POST /mail/send-from-template` accept a `moodleSenderChoice` parameter (`'default'` | `'auth'` | `'tutor'`) that selects which Moodle token is used. See `MailService.resolveToken()` for the full logic.

`MailModule` imports `MoodleModule` (for `MoodleService`). Avoid creating a reverse import from `MoodleModule` into `MailModule` — it would create a circular dependency.

## Email log (`email_log`)
Every real send is recorded in the `email_log` table by `MailService.sendMail` (which wraps the real send `deliverMail`): actor (from JWT, passed by the controller via `@Req`), recipient, subject, template id/name, sender mode, the **resolved real sender** (`from_name`/`from_email` — what the recipient sees, returned by `deliverMail`), `via_moodle`, and `status` (`sent`/`failed` + `error_message`). Best-effort (`recordEmailLog` never throws/blocks the send) and **never stores the email body** (it contains the `{CLAVE_MOODLE}` password). Has a free-text `notes` column and a `metadata` jsonb column, both for future use (`recordEmailLog` accepts them; no caller fills them yet). The ad-hoc "test mail" path (`/mail/send` with an inline `smtp` body) is not logged.
- Migrations: table `0045`, `from_email` column `0046`, `metadata` column `0047`.
- No double logging: `AuditInterceptor` skips `/mail/send` and `/mail/send-from-template` (they live here, richer); `/mail/connection` is still audited generically. See `docs/security.md`.
- Read-only query API: `GET /email-log` (ADMIN, served by `EmailLogController` in `api/audit/`, paginated + filters status/actor/recipient); UI at Administración → Herramientas → "Registro de envíos de correo" (`/tools/email-log`).
