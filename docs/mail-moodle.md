# Moodle integration & Mail

Read before touching `api/moodle/`, `api/mail/`, or notification/token logic.

## Moodle integration
`MoodleService` (`server/src/api/moodle/moodle.service.ts`) wraps all Moodle Web Services calls. The org-level Moodle token is stored encrypted in `organization_settings` (via `secrets.util.ts`); per-user tokens live only in the `moodle_user_auth_user` links. The optional custom plugin `block_advanced_reports_get_userstats` is gated by `organization_settings.settings.plugins.itop_training` — when enabled, it syncs `time_spent` and uses custom endpoints when creating users. The other plugin flags (`configurable_reports`, `certificates`, `progress_bar`) are declared in settings but currently unused by the code.

Every Moodle-created local course is an edition and must reference `catalog_courses`. `upsertMoodleCourse` calls `CatalogCourseRepository.ensurePendingByName`: an exact normalized catalog name is reused; otherwise a `PENDIENTE_REVISION` catalog entry is created without blocking the import. See `docs/course-catalog.md`.

`moodle_users.moodle_password` is stored in plaintext on purpose (shown to users) — see `docs/security.md`.

## Custom fields de perfil (usuarios subidos a Moodle)
`settings.moodle.customfields` (`[{ shortname, source: dni|company_name|company_cif }]`, see `docs/organization.md`) defines which Moodle profile fields get filled when pushing local users. `company_name` renders as `"Empresa (Centro)"` — company + the user's (main) center from `resolveUserCompanyInfo` — falling back to just the company when the center has no name. Values are built by `buildMoodleCustomFieldValues` (**only non-empty values** — an empty local field never clears the Moodle value; wire shape is `{ type: <shortname>, value }` — the write WS uses `type` for the shortname, unlike the read shape of `core_user_get_users`) and sent via `core_user_update_users` in two paths: right after creation (`upsertLocalUsersToMoodle` → `ensureProfileInitialized`) and on explicit update (`updateLocalUserInMoodle`). Requires **Moodle ≥ 4.x**: with 3.9 the WS didn't apply customfields, so the send was disabled until 2026-07 (re-enabled after upgrading the org's Moodle to 4.5).

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

## Pushing a group to Moodle (`POST /moodle/groups/:groupId/push`)
`pushGroupToMoodle` (client button "Subir a Moodle" on the group ficha) creates or updates the Moodle group. Two branches:
- **Group already has `moodle_id`**: `core_group_update_groups` — only sends `name`/`description`, **never dates**. Re-pushing an already-created group cannot fix a wrong start/end date; there is no update-dates path (see below).
- **New group** (`itop_training` enabled, the normal case): the custom plugin function `block_gestion_grupos_create_group_custom1`, which **does** take `startdate`/`enddate` (`DD/MM/YYYY`, from `localGroup.start_date`/`end_date` falling back to `course.start_date`/`end_date`). Without `itop_training`, falls back to plain `core_group_create_groups` (name/description only, no dates at all).

**Timezone gotcha (fixed, commit `1df51dc`, "-1 day bug"):** the date formatter (`fmtDate`, inline in `pushGroupToMoodle`) must derive the day/month/year using **Moodle's timezone explicitly** (`dayjs(d).tz('Europe/Madrid').format('DD/MM/YYYY')`, the shared tz-aware `dayjs` from `common/utils/dayjs-tz.ts`), not the Node process's own local timezone (`new Date(...).getDate()` etc.) — the server's actual runtime timezone isn't guaranteed to be `Europe/Madrid` (e.g. UTC on Render), so reading date parts with plain `Date` getters silently shifted the pushed date back one day whenever the process ran in a timezone behind Madrid. This is the exact same class of bug already fixed for **enrolment** dates in `addLocalUsersToMoodleGroup`'s `toUnixSeconds` (below) — both must always go through the shared `dayjs-tz` import with an explicit `.tz(MOODLE_TZ)`, never bare `Date` getters/setters, for any value ultimately sent to Moodle.

**`block_gestion_grupos`'s other exposed functions** (from the Moodle instance's enabled Web Service function list): `create_group_custom1` (used above), `delete_group`, `create_and_enrol_user`, `create_candidate`, `search_users`, `send_message` — **no update-dates function exists**. If a group's date was pushed wrong (e.g. before the timezone fix above), the only fix is editing it directly in Moodle; re-pushing from the app does nothing for dates once `moodle_id` is set.

`addLocalUsersToMoodleGroup` (same push flow, re-enrolling every selected user in the parent course) resolves enrolment start/end from `localGroup.start_date`/`end_date` (falling back to `course.start_date`/`end_date`, same priority as above) via `toUnixSeconds(d, endOfDay)`: start = `00:00:01`, end = `23:59:59`, both computed in `MOODLE_TZ` ('Europe/Madrid') then converted to a UTC unix timestamp — this path was already timezone-safe before the group-push fix above, and is what the fix was modeled on.

## Unenrolling a user from a group/course (`POST /moodle/groups/:groupId/users/:userId/unenroll`)
`unenrollUserFromGroupAndCourse` is the only place that removes a Moodle enrolment (everything else in this file only adds). Client entry point: the "Dar de baja" button per group tag in the user's "Cursos" tab (`UserCoursesSection`), gated to ADMIN/MANAGER and requiring the user's own app password (`ConfirmPasswordModal` → `POST /auth/verify-password`) before calling this endpoint.

Flow, scoped to one group/course pair (other enrolments of the same user are untouched):
1. If the group/course/user are all linked to Moodle (`groups.moodle_id`, `courses.moodle_id`, and the `moodle_users.moodle_id` resolved from `user_course.id_moodle_user`): `core_group_delete_group_members` removes them from the Moodle group; if `isUserEnrolledInOtherGroups` then says they're in no other local group of that course, `enrol_manual_unenrol_users` also unenrols them from the course entirely in Moodle.
2. **Any Moodle failure aborts the whole operation — the DB is left untouched** (deliberate choice: never let local and Moodle state diverge silently). If the user/group/course simply isn't linked to Moodle, the Moodle step is skipped (not an error) and only the local removal runs.
3. On success (or skip), reuses `GroupService.deleteUserFromGroup` — same local cleanup as the admin group-membership screen (`DELETE /group/:id/users/:userId`, ADMIN-only, DB-only, unrelated code path — deliberately not touched by this feature so its existing callers keep their pure-local behavior).

`core_group_delete_group_members` and `enrol_manual_unenrol_users` must be enabled on the org's Moodle WS token — neither was used anywhere before this feature (everything else in this service only enrols/adds).

## User matching on import (Moodle → local user)
All three import paths (`upsertMoodleUserAndEnrollToCourse`, `upsertMoodleUserByGroup`, `importMoodleUsers`) resolve the local user through the single helper **`linkOrCreateLocalUserForMoodleUser`**, which also guarantees the `moodle_user` link. The DNI-variant logic lives in `moodle-user-matching.util.ts` (shared with the link audit, `docs/moodle-audit.md`; the service's private methods just delegate). Match order:

1. **`moodle_id`** → existing `moodle_user` row. Only `moodle_username` is refreshed.
2. **DNI** → `userRepository.findByDniAny(variants)`, one indexed query over the variants from `moodleUserDniVariants`: the `dni` customfield **and** the `username` when it validates as DNI/NIE (`utils/dni.util.ts`). Both raw and normalized (upper/lower, no separators), because `users.dni` is stored uppercase/compact while Moodle returns lowercase. **This is not a heuristic**: `createLocalUsersInMoodle` creates Moodle users with `username = normalizeDni(user.dni)`, so the username *is* the DNI for anyone the app pushed up.
3. **Create** a new local user. Its `dni` is filled **only** when the `username` is a valid document (normalized) — the DNI can't collide with the `users.dni` unique index because that exact value was just searched in step 2 without a hit (a unique violation would abort the whole course transaction).

**Email is deliberately not a matching key** — `users.email` is explicitly non-unique (students commonly share a company address), so matching on it would merge distinct people.

Personal data (`name`/`first_surname`/`email`) of an **existing** user is never overwritten from Moodle; only `importMoodleUsers` (the "traer usuarios" endpoint) refreshes it, and only for users matched by `moodle_id`.

Wrong links created by the pre-fix exact-`eq` matching (duplicates whose `moodle_id` points at the duplicate) don't self-heal — the **Auditoría de Moodle** tool (`docs/moodle-audit.md`) detects and repairs them.

**Center is optional on Moodle imports.** `group.service.addUserToGroup` requires a center for the `student` role, but users arriving from Moodle need not have one (not every course is FUNDAE-funded). `upsertMoodleUserByGroup` resolves the center best-effort via `ensureMainCenterForUserFromAny` (promotes any existing `user_center` to main) and passes `allowWithoutCenter: true`, so a user with no center gets `user_group.id_center = NULL` instead of being dropped from the import along with their progress. Same pattern as `inaem-import.service.ts` and `user.service.ts`.

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

### Template variables (`{NOMBRE_CURSO}`, `{FECHA_INICIO}`, `{FECHA_FIN}`, `{USUARIO_MOODLE}`, `{CLAVE_MOODLE}`)
The list is centralized in `client/src/constants/mail/mail-template-variables.ts` (`MAIL_TEMPLATE_VARIABLES`). Substitution is done server-side by two shared private helpers on `MailService`: `buildTemplateVariables(userId?, courseName?, courseStart?, courseEnd?)` (does the `moodleUserRepository.findByUserId` lookup for `{USUARIO_MOODLE}`/`{CLAVE_MOODLE}` — **never sent to the client**, see `docs/security.md`) and `applyVariables(input, variables)`. `sendMailFromTemplate` always substitutes. Plain `sendMail` only substitutes when the caller passes `applyVariables: true` (plus `courseName`/`courseStart`/`courseEnd`/`userId` as available) — used by the "Correo personalizado" flow in `SendMailToGroupModal.tsx`/`SendMailModal.tsx` so free-form custom emails can use the same variables as templates. `AdminNotificationService` never sets the flag, so its notifications are unaffected.

Both send modals also have a **"Personalizar"** button on the template preview (copies subject/content into "Correo personalizado" for editing) and an **"Enviar prueba"** button that sends a single copy to an admin-entered address — always via SMTP only (`sendViaMoodle: false`) and without a real `userId`, so `{USUARIO_MOODLE}`/`{CLAVE_MOODLE}` resolve empty instead of leaking a student's Moodle password to an arbitrary test address.

### Attachments (`SendMailOptions.attachments`)
`MailService.deliverMail` accepts `attachments?: { filename, content: Buffer, contentType? }[]`, forwarded as-is to nodemailer's `sendMail`. **SMTP only** — the Moodle-notification path (`sendViaMoodle`) sends plain text and never carries attachments, so any flow needing an attachment (currently only `docs/reports.md`'s `/reports/send`, the center-report mailer) shouldn't offer a "vía Moodle" option. `email_log` doesn't record attachment metadata (it never stores the body either).

### Cc/Bcc (`SendMailOptions.cc`/`.bcc`)
Optional `string[]`, **SMTP only** (same restriction as attachments — not sent through the Moodle-notification path). `deliverMail` dedupes them against `to` (and `bcc` against `cc` too) so the same address never appears twice across headers. Currently only wired up in `/reports/send` (`ReportSendDTO.cc`/`.bcc`, free-text tag inputs in `SendReportMailModal`) — deliberately **not** applied to `/reports/send/test`, which must stay a single copy to the test address without touching any real recipient.

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
