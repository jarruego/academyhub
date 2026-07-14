# Moodle integration & Mail

Read before touching `api/moodle/`, `api/mail/`, or notification/token logic.

## Moodle integration
`MoodleService` (`server/src/api/moodle/moodle.service.ts`) wraps all Moodle Web Services calls. The org-level Moodle token is stored encrypted in `organization_settings` (via `secrets.util.ts`); per-user tokens live only in the `moodle_user_auth_user` links. The optional custom plugin `block_advanced_reports_get_userstats` is gated by `organization_settings.settings.plugins.itop_training` — when enabled, it syncs `time_spent` and uses custom endpoints when creating users. The other plugin flags (`configurable_reports`, `certificates`, `progress_bar`) are declared in settings but currently unused by the code.

`moodle_users.moodle_password` is stored in plaintext on purpose (shown to users) — see `docs/security.md`.

## Token resolution
`process.env.MOODLE_TOKEN` is a legacy fallback that may not be set in production. The real org-level token lives in `organization_settings.encrypted_secrets`, read via `MoodleService.resolveMoodleToken()`. `MailService.resolveToken()` implements the full priority chain for notifications:
1. `moodle_user_auth_user.moodle_token` — link-specific token for the `auth_user`+`moodle_user` pair (highest `id` wins if several)
2. `MoodleService.resolveMoodleToken()` — org-level token (default when `moodleSenderChoice = 'default'`)

The old `auth_user.moodleToken` column was removed (migration 0054); links are the only per-user token source. `AuthUserService.findAll()` exposes `has_moodle_token` (= has at least one link) for the admin listing.

Only implemented in `MailService.resolveToken()` — other call sites must replicate it manually; no shared helper exists yet.

The Moodle **URL** resolves with priority: DB `encrypted_secrets.moodle_url` → `settings.moodle.url` → `process.env.MOODLE_URL`.

## Active courses & groups (daily sync gate)
The daily progress sync acts **only on active groups**: `MoodleActiveProgressTask` → `getActiveCoursesProgress()` → `groupRepository.findActiveGroupsWithCourse()`. Gated by env vars `MOODLE_ACTIVE_SYNC_ENABLED` / `MOODLE_ACTIVE_SYNC_CRON` (defaults in `CLAUDE.md`). The active-state **model** itself (group `active_mode`/dates → derived course active, client/server mirror utils) is a cross-cutting domain concept → `docs/architecture.md`. Note `upsertMoodleGroup` only syncs name/description, so group dates (which drive `auto` activeness) are never set from Moodle.

**Cron = metrics-only, per course.** The cron iterates **per active course** (not per group) calling `refreshActiveCourseProgress(course)`, which only refreshes `completion_percentage`/`time_spent` of **already-linked** users (no new enrolments — those belong to the manual importers / "Traer de Moodle"). Cost: **1 call** `block_advanced_reports_get_usercompletion(courseid)` + **1 call** `get_userstats(courseid, platformdedicationtime)` (only if `itop_training` enabled) per course. Membership and the `moodle_id ↔ id_user` mapping are resolved from the DB via `userGroupRepository.findCourseProgressTargets(courseId, groupIds)`.

## Moodle call-efficiency model (imports & sync)
- **Token/URL resolution is cached** in-memory (60s TTL) inside `MoodleService` (`resolveMoodleToken`/`resolveMoodleUrl`) so the per-request resolution no longer hits `organization_settings` on every HTTP call.
- **Bulk stats via the itop plugin** (`block_advanced_reports`), all returning `{ values: [ { userid, value } ] }` — parsed by the shared `extractAdvancedReportsRows`/`buildUserValueMap` helpers:
  - **Completion %**: always from per-user `core_completion` (`getUserProgressInCourse` → `core_completion_get_activities_completion_status`), the real activity-based %. It's **deduplicated to once per course** via `progressCache`/`getProgressOptimized` (`preloadCourseProgress` preloads it once; `loadCourseSyncContext` clears the cache per course and the enrolled loop + every group reuse it), so a student is queried once even across multiple groups — not once per group as before. There is **no bulk completion path**: `get_usercompletion` was verified to return the **course-completion STATE** (localized text like `"Aún no comenzado"`), not the activity %, so it zeroed students with real progress and was removed. (If a plugin ever exposed a *numeric* progress stat via `get_userstats`, that would be the only language-safe way to bulk it — not currently available.)
  - `get_userstats(courseid, platformdedicationtime)` → time_spent in **1 call** (`getAdvancedReportsUserStats`).
- **Full imports load course context once.** `importMoodleCourses` / `importSpecificMoodleCourse` call `loadCourseSyncContext(moodleCourseId, enrolledUsers, ...)` a single time (roles map from the already-fetched enrolled users + bulk completion preloaded into `progressCache` + bulk time map) and pass it as `courseContext` to `processGroupMembers` for every group, instead of re-fetching enrolled/completion/time per group. Without `itop_training`, completion falls back to lazy per-user `getProgressOptimized` (cached across groups).
- **Targeted fetch** to find one course/group: `getCourseByMoodleId` (`core_course_get_courses` + `options[ids]`) and `getGroupsByIds` (`core_group_get_groups`, returns each group's `courseid`) — replaces the old "download all courses / scan every course's groups" patterns.
- The single legacy import-all path was removed from `course.service`/`course.controller`; `/moodle/import-all` (uses `processGroupMembers`) is the only one.
- **Per-course transactions.** `importMoodleCourses` (import-all) no longer wraps the whole import in one giant transaction: it fetches the course list outside any tx and processes **each course in its own transaction** (`importSingleMoodleCourseTx`), so a failing course is skipped (logged) without rolling back or blocking the rest, and no tx is held open for the whole run. `importSpecificMoodleCourse` stays single-course/single-tx.
- **Call instrumentation.** Every Moodle HTTP call goes through `request()`, which increments a counter (`moodleCallCount` getter, `getMoodleCallStats()` for the per-function breakdown). `importMoodleCourses`, `importSpecificMoodleCourse` and the cron log how many Moodle calls each run made — use this to verify the call reduction.
- **Pending (not done):** cross-course concurrency (`p-limit`) — blocked on making the instance-level `progressCache` per-operation first (concurrent courses would clobber it), plus Moodle rate-limit considerations.

## Mail system
Mail templates are stored in the database (`mail_templates` table). Template images are stored in Supabase Storage (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` env vars). `MailService` sends Moodle notifications using the token resolution chain above.

`POST /mail/send` and `POST /mail/send-from-template` accept a `moodleSenderChoice` parameter (`'default'` | `'auth'` | `'tutor'`) that selects which Moodle token is used. See `MailService.resolveToken()` for the full logic.

`MailModule` imports `MoodleModule` (for `MoodleService`). Avoid creating a reverse import from `MoodleModule` into `MailModule` — it would create a circular dependency.

## Admin failure notifications (`AdminNotificationService`)
`server/src/notifications/` (`NotificationsModule` → `AdminNotificationService`) sends an SMTP email (via `MailService.sendMail`, no Moodle) to **every `auth_user` with role `admin`** when an unattended job fails. Recipients come from `authUserRepository.findAll({ role: 'admin' })` (empty/blank emails filtered). `notifyScheduledJobFailure({ source, error, jobId?, details? })` is **best-effort**: it never throws (missing SMTP, no admins, send error → logged only), so it can't affect the calling flow. Error text is HTML-escaped. Timestamp uses `SCHEDULER_TIMEZONE`. The send is recorded in `email_log` with actor `system`.

Wired at two failure funnels:
- **SAGE import** — called from `ImportService.failJob` (the single point where any SAGE `import_job` becomes `FAILED`, covering both manual and scheduled runs, and pre-processing failures like FTP/extraction). Fire-and-forget (`void`).
- **Moodle active-progress sync** — called from `MoodleActiveProgressTask.execute`: on a global failure (can't even list active courses → notify **and** rethrow so the scheduler logs it) and on partial failures (some courses errored → notify with a sample of up to 10, without rethrowing).

To avoid a cycle, `NotificationsModule` imports `MailModule` (which now **exports `MailService`**); `ImportModule` and `SchedulerModule` import `NotificationsModule`. The `AdminNotificationService` dep is injected optionally into `ImportService` (`?.`) so its pure-method unit tests still construct it with a stub.

## Email log (`email_log`)
Every real send is recorded in the `email_log` table by `MailService.sendMail` (which wraps the real send `deliverMail`): actor (from JWT, passed by the controller via `@Req`), recipient, subject, template id/name, sender mode, the **resolved real sender** (`from_name`/`from_email` — what the recipient sees, returned by `deliverMail`), `via_moodle`, and `status` (`sent`/`failed` + `error_message`). Best-effort (`recordEmailLog` never throws/blocks the send) and **never stores the email body** (it contains the `{CLAVE_MOODLE}` password). Has a free-text `notes` column and a `metadata` jsonb column, both for future use (`recordEmailLog` accepts them; no caller fills them yet). The ad-hoc "test mail" path (`/mail/send` with an inline `smtp` body) is not logged.
- Migrations: table `0045`, `from_email` column `0046`, `metadata` column `0047`.
- No double logging: `AuditInterceptor` skips `/mail/send` and `/mail/send-from-template` (they live here, richer); `/mail/connection` is still audited generically. See `docs/security.md`.
- Read-only query API: `GET /email-log` (ADMIN, served by `EmailLogController` in `api/audit/`, paginated + filters status/actor/recipient); UI at Administración → Herramientas → "Registro de envíos de correo" (`/tools/email-log`).
