# Permissions matrix (role × action)

**Read this before adding/removing/changing any `RoleGuard([...])`, `AuthzHide roles={[...]}`, inline role check, or punctual capability flag (`auth_users.<flag>`).** This file — together with `client/src/components/auth-users/permissions-matrix.content.ts` (the same data, curated for the in-app panel) — is the maintained registry CLAUDE.md's "Critical conventions" points to. Update **both** whenever a permission changes; they must never drift apart. The in-app panel (Gestión de usuarios → "Ver matriz de permisos por rol", ADMIN-only, `PermissionsMatrixPanel.tsx`) renders the `.content.ts` file directly, so editing that file is what actually changes what ADMIN sees — this `.md` file is the fuller, endpoint-level reference for developers.

Roles: `ADMIN`, `MANAGER`, `VIEWER`, `TUTOR`, `CONSULTOR` (`docs/security.md`'s "## Roles" — read it first for what "split" means and the three documented ones). ✅ = has access · ❌ = no access · **flag** = only via the punctual `can_manage_candidates` flag (`docs/security.md`) regardless of role.

Initial audit: 2026-09-09, followed same-day by a round of deliberate decisions (see "Changelog" at the bottom) — several MANAGER/client-vs-server gaps found by the audit were closed, not just documented. Scope note: a GET with **no guard at all** (neither class- nor method-level) is reachable by any of the 5 roles via the global `AuthGuard` alone — noted per-row as "no guard" where it matters (mostly reference/lookup GETs).

## 1. Auth / user management

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Login / logout | ✅ | ✅ | ✅ | ✅ | ✅ | `POST auth/login` is `@Public()`; logout has no explicit guard (global `AuthGuard` only) |
| `POST auth/signup` (legacy route) | ✅ | ❌ | ❌ | ❌ | ❌ | |
| `POST auth/verify-password` (step-up reauth) | ✅ | ✅ | ✅ | ✅ | ✅ | Used before "Importar Preinscritos INAEM" |
| List/create/edit/delete auth users, Moodle links | ✅ | ❌ | ❌ | ❌ | ❌ | All of `auth_user.controller.ts` |
| "Gestión de usuarios" screen | ✅ | ❌ | ❌ | ❌ | ❌ | `AuthUserManagement.tsx` full-page gate |
| Audit log (`/tools/audit-log`) | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Email log (`EmailLog.tsx`) | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Backups panel | ✅ | ❌ | ❌ | ❌ | ❌ | |

## 2. Organization / SMTP / mail templates

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| View org settings | ✅ | ✅ | ✅ | ✅ | ✅ | `GET /organization/settings` — **no guard at all** |
| Edit org settings / upload logo-signature | ✅ | ❌ | ❌ | ❌ | ❌ | |
| View SMTP settings (password always masked) | ✅ | ✅ | ✅ | ✅ | ✅ | Read-only API GET, unaffected by the screen gate below |
| Save SMTP settings / test connection | ✅ | ❌ | ❌ | ❌ | ❌ | |
| `/organization/smtp` screen | ✅ | ❌ | ❌ | ❌ | ❌ | Gated 2026-09-09 (was open to any authenticated role — see Changelog) |
| View mail templates | ✅ | ✅ | ✅ | ✅ | ✅ | Read-only API GET, unaffected by the screen gate below |
| Create/edit/delete template, upload image | ✅ | ❌ | ❌ | ❌ | ❌ | |
| `/organization/mail-templates` screen | ✅ | ❌ | ❌ | ❌ | ❌ | Gated 2026-09-09, same reason |

## 3. Import SAGE

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Everything (upload CSV/FTP, decisions, jobs, failed users, cleanup) | ✅ | ❌ | ❌ | ❌ | ❌ | Class-level `[ADMIN]` since 2026-09-09 (was `[ADMIN, MANAGER]` — see Changelog: it's an automated/cron or ADMIN-only task, not MANAGER's) |
| `/tools/import-sage` screen | ✅ | ❌ | ❌ | ❌ | ❌ | Already matched the narrowed server guard |

## 4. Import INAEM (general tool)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Import Acciones / Alumnos | ✅ | ❌ | ❌ | ❌ | ❌ | Narrowed to ADMIN-only 2026-09-09 (was ADMIN/MANAGER — see Changelog) |
| Import Preinscripciones, unrestricted | ✅ | ❌ | ❌ | ❌ | ❌ | Same change |
| Import Preinscripciones, **scoped to one edition** | — | flag | flag | flag | flag | `restrictToFileNumber` + `createMissingCourses: false`; MANAGER now needs the flag too, same as everyone else. See `docs/import-inaem.md` |
| Job status (`job-status/:jobId`) | ✅ | flag* | flag* | flag* | flag* | Guard itself is still 5-role, but only useful to non-ADMIN for a job they started via the scoped (flag) path |
| Per-user/course preinscripciones, enrolled count, conflicts | ✅ | ❌ | ❌ | ❌ | ❌ | Narrowed to ADMIN-only 2026-09-09 |
| Delete a course's preinscripciones | ✅ | ❌ | ❌ | ❌ | ❌ | |
| `/tools/import-inaem` screen | ✅ | ❌ | ❌ | ❌ | ❌ | Narrowed 2026-09-09 — MANAGER has nothing useful left there |
| "Importar Preinscritos INAEM" button (edition ficha) | ✅ | flag | flag | flag | flag | `course-candidates-section.tsx`; MANAGER demoted from full access to flag-gated 2026-09-09 |

## 5. Mail / Moodle sync

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| `POST /mail/send`, `/mail/send-from-template` | ✅ | ✅ | ❌ | ✅ | ❌ | **Split 1** (`docs/security.md`) — "Correo" button. Reviewed 2026-09-09, kept as-is on purpose |
| Tutor Moodle token status | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Import a whole course/group from Moodle | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Sync group members from Moodle | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Push group to Moodle | ✅ | ✅ | ❌ | ❌ | ❌ | Widened to MANAGER 2026-09-09 (was ADMIN-only) |
| Add/preview members to Moodle group, unenroll user | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Delete group in Moodle | ✅ | ❌ | ❌ | ❌ | ❌ | Destructive, kept ADMIN-only on purpose |
| Create/update/preview Moodle user, sync single username | ✅ | ✅ | ❌ | ❌ | ❌ | |
| `import-all`, `sync-usernames`, `check`, `active-courses-progress` | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Read-only Moodle lookups (users/courses/groups/enrolled/profiles) | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| `/tools/moodle-import` screen | ✅ | ❌ | ❌ | ❌ | ❌ | Consistent — every action here is ADMIN-only |

## 5b. SMS (Mailrelay)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| View SMS settings (`api_key` always masked) | ✅ | ✅ | ✅ | ✅ | ✅ | `GET /sms-settings`, same pattern as SMTP |
| Save SMS settings / test connection with Mailrelay | ✅ | ❌ | ❌ | ❌ | ❌ | `POST /sms-settings`, `POST /sms/connection` |
| `/organization/sms` screen | ✅ | ❌ | ❌ | ❌ | ❌ | Same ADMIN-only gate as `/organization/smtp` |
| View SMS templates | ✅ | ✅ | ✅ | ✅ | ✅ | `GET /sms-templates` |
| Create/edit/delete SMS template | ✅ | ❌ | ❌ | ❌ | ❌ | `POST/PUT/DELETE /sms-templates` |
| `POST /sms/send`, `/sms/send-from-template` | ✅ | ✅ | ❌ | ✅ | ❌ | Same split as mail (§5) — "SMS" button in group screen and test send |
| SMS log (`/tools/sms-log`) and "Actualizar estado" | ✅ | ❌ | ❌ | ❌ | ❌ | `GET /sms-log`, `POST /sms-log/:id/refresh-status`, same criterion as email log (§1) |

## 6. Moodle Audit

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR |
|---|---|---|---|---|---|
| Everything (report, refresh, sync-status, delete-in-Moodle, protect, relink, orphan cleanup, fix-usernames) | ✅ | ❌ | ❌ | ❌ | ❌ |

Class-level `[ADMIN]`, no exceptions.

## 7. Moodle ↔ DB comparison / account management

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| `user-comparison` (compare/link/unlink) | ✅ | ❌ | ❌ | ❌ | ❌ | `DataCrossReference.tsx` full-page `AuthzHide[ADMIN]` |
| Search/view Moodle accounts, a Moodle account's courses | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| Edit/delete Moodle account, manual link, set-main-by-highest, init-usernames, unlink, stats | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Set an account as main (`set-main`) | ✅ | ✅ | ❌ | ❌ | ❌ | Only `[ADMIN, MANAGER]` method here |

## 8. Forum Duplicator

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR |
|---|---|---|---|---|---|
| List forums/topics/posts, preview and run duplication | ✅ | ✅ | ❌ | ❌ | ❌ |

Class-level `[ADMIN, MANAGER]`. "Foros" button in course ficha matches (`AuthzHide[ADMIN, MANAGER]`).

## 9. Course Candidates / Course Catalog / Course Interests

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| View candidates of an edition | ✅ | ✅ | ✅ | ✅ | ✅ | Class-level 5-role guard |
| Create/delete/bulk-update candidates | ✅ | ✅ | flag | ✅ | flag | **Split 3** (see below) |
| View interest pool | ✅ | ✅ | ✅ | ✅ | ✅ | Class-level 5-role guard |
| Create/incorporate/delete interest, bulk-update | ✅ | ✅ | ❌ | ✅ | ❌ | **Split 3** |
| View catalog courses | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| Create / edit / merge a catalog course | ✅ | ❌ | ❌ | ❌ | ❌ | "Nuevo curso de catálogo" / "Fusionar" buttons |
| Edit catalog course contents | ✅ | ✅ | ❌ | ❌ | ❌ | |

**Split 3: candidate/interest management inside a course edition.** `POST/DELETE/PUT(bulk) /course-candidates` and the equivalent `course-interests` writes are `RoleGuard([ADMIN, MANAGER, TUTOR])` — `TUTOR` gets full write access here **without** needing `can_manage_candidates`, same as `VIEWER`/`CONSULTOR` do need it. The client mirrors it: `course-detail.route.tsx`'s `canEditCandidates = [ADMIN, MANAGER, TUTOR].includes(role) || canManageCandidates`. **Confirmed intentional 2026-09-09**: `TUTOR` should be able to add candidatos/interesados but not peticiones (§10) — different from Course Requests on purpose, not an oversight.

## 10. Course Requests (Peticiones de centros)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| View requests, report, PDF, detail | ✅ | ✅ | ✅ | ✅ | ✅ | Class-level 5-role guard |
| Create/edit/duplicate/close/reopen/delete, upload Excel, assign/release students | ✅ | ✅ | ❌ | ❌ | ❌ | Deliberately narrower than §9's Split 3 — confirmed intentional 2026-09-09, see the note there |

## 11. Cursos / Ediciones

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Create course | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Edit course (full ficha) | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Edit course — **Planificación fields only** | — | — | flag | flag | flag | Rest of the fields silently dropped without the flag |
| View course / list / course's groups | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| Enroll/edit/delete user in course, delete course | ✅ | ❌ | ❌ | ❌ | ❌ | |
| "Guardar Curso" / "Eliminar Curso" buttons | ✅ | ✅ (save only) | ❌ | ❌ | ❌ | |
| Candidatos tab inline field edit | ✅ | ✅ | flag | ✅ | flag | Part of **Split 3** |

## 12. Grupos

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Create group | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Edit group (name/dates/tutors) | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Generate bonificación XML | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Bulk-add users / assign tutors | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Enroll one user (`POST :id/users/:userId`) | ✅ | ❌ | ❌ | ❌ | ❌ | Narrower than the bulk endpoint |
| View group / list / group's students | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| Delete group, delete/edit user in group | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Matricular / Moodle dropdown / Exportar / Bonificar buttons | ✅ | ✅ | ❌ | ❌ | ❌ | `GroupUsersManager` |
| Correo / Enviar informe buttons | ✅ | ✅ | ❌ | ✅ | ❌ | Split 1/2 |
| Selección rápida (0%/1-75%/≥75%) | ✅ | ✅ | ❌ | ✅ | ❌ | UI-only filter, still gated like Split 1/2 |

## 13. Empresas / Centros

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Create company/center | ✅ | ❌ | ❌ | ❌ | ❌ | "Añadir Centro" button (from company ficha) narrowed to ADMIN 2026-09-09 to match — was showing to MANAGER despite the server always being ADMIN-only |
| Edit company/center | ✅ | ❌ | ❌ | ❌ | ❌ | Client narrowed 2026-09-09 to match the server (was showing an editable form + "Guardar" to MANAGER, who got a 403 on submit) |
| "Guardar"/"Eliminar" buttons (company/center ficha) | ✅ | ❌ | ❌ | ❌ | ❌ | Same fix — both were `AuthzHide[ADMIN, MANAGER]`, narrowed to `[ADMIN]` |
| Bulk-update users' main center | ✅ | ✅ | ❌ | ❌ | ❌ | Unchanged — a distinct, already-consistent action |
| Delete company/center, add/edit/delete user in center | ✅ | ❌ | ❌ | ❌ | ❌ | |
| View company/center, list, center's users | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| "Formación en el centro" tab | ✅ | ✅ | ❌ | ✅ | ❌ | Split 1 |

## 14. Usuarios (personas)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Create user (`POST /user`) | ✅ | ❌ | ❌ | ❌ | ❌ | Narrowed to ADMIN-only 2026-09-09 (was `[ADMIN, MANAGER]`) — see Changelog. Does **not** affect adding a new candidato/interesado (§9): that creates the person through `POST /course-candidates`/`course-interests`, a separate endpoint already allowing `TUTOR` |
| Import from Moodle, bulk enroll/edit | ✅ | ✅ | ❌ | ❌ | ❌ | Unchanged — distinct endpoints from plain user creation |
| Edit user (full ficha) | ✅ | ✅ | ❌ | ✅ | ❌ | `hasFullAccess = [ADMIN, MANAGER, TUTOR]` |
| Edit user — **identity fields only** | — | — | flag | (already full access) | flag | `USER_IDENTITY_FIELDS`; quick-add / duplicate-merge flows |
| View/list users, a user's centers/courses, certificate | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| Delete user | ✅ | ❌ | ❌ | ❌ | ❌ | |
| "Crear usuario" button (listing) | ✅ | ❌ | ❌ | ❌ | ❌ | Now consistent with the narrowed server guard |
| `/create-user` page | ✅ | ❌ | ❌ | ❌ | ❌ | Gated 2026-09-09 (page itself had no guard — MANAGER could reach it by URL and would now 403 on submit) |
| "Enviar correo" icon (user ficha) | ✅ | ✅ | ❌ | ✅ | ❌ | Split 2 |

## 15. Reports (Informes)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| List reports, roles, facets | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Export PDF/Excel | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Export **with passwords** (`include_passwords`) | ✅ | ✅ | ❌ | ✅ | ❌ | Widened to `TUTOR` 2026-09-09 (see Changelog) |
| Send report to centers (`send/groups`, `send`, `send/test`) | ✅ | ✅ | ❌ | ✅ | ❌ | **Split 1** |
| Send report **with passwords** (`dedication_passwords`) | ✅ | ✅ | ❌ | ✅ | ❌ | Widened to `TUTOR` 2026-09-09 — now a straight subset of Split 1 instead of a separate exclusion |
| "Incluir contraseñas" checkbox | ✅ | ✅ | ❌ | ✅ | ❌ | `reports.route.tsx` and `SendReportMailModal.tsx` |

## 16. User Merge / User Sanitization

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR |
|---|---|---|---|---|---|
| Duplicate merge (candidates, preview, execute) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Data sanitization (issues, fix, fix-all) | ✅ | ❌ | ❌ | ❌ | ❌ |

Both class-level `[ADMIN]`.

---

## Open items (pending a decision)

None open as of 2026-09-09 — the last one (`dedication_passwords`/`TUTOR`, below) was resolved the same day.

## Changelog

**2026-09-11 — new SMS module (Mailrelay).** New section §5b, same split/gating criteria as mail (§5) and email log (§1): settings read for all 5 roles, write/test/templates/log ADMIN-only, send `[ADMIN, MANAGER, TUTOR]`. See `docs/sms.md`.

**2026-09-09 — round of decisions following the initial audit.** All of these were explicit user decisions, not unilateral changes:
- **Import SAGE** narrowed to `[ADMIN]` (was `[ADMIN, MANAGER]`) — it's an automated (cron) or ADMIN-only task, not MANAGER's.
- **Import INAEM** (general tool + the per-edition button): MANAGER demoted from full/unrestricted access down to the same `can_manage_candidates`-flag-gated access everyone else has. `hasFullAccess` in `InaemImportController.upload` is now `role === ADMIN` only.
- **`/organization/smtp` and `/organization/mail-templates`** screens gated to ADMIN (previously had no client-side role check at all, reachable by any authenticated role via direct URL).
- **Empresas/Centros**: client `canEdit` narrowed to ADMIN-only (was `[ADMIN, MANAGER]`, while the server was already ADMIN-only) — closes the "editable form the server rejects" gap. Applies to `company-detail.route.tsx`, `center-detail.route.tsx`, and the "Añadir Centro" button.
- **`POST /user`** (create a single user) narrowed to `[ADMIN]` (was `[ADMIN, MANAGER]`), and `/create-user` gained a page-level ADMIN-only gate (previously reachable by MANAGER via direct URL, matching the already-ADMIN-only listing button). Verified this does **not** affect adding a new candidato/interesado (§9), which goes through a separate, still-`TUTOR`-accessible endpoint.
- **Course Requests vs. Candidatos/Interesados** (§9 vs §10): confirmed intentional — `TUTOR` gets write access to the latter two but not to Peticiones. Not a bug to fix.
- **`dedication_passwords`/`include_passwords` widened to `TUTOR`** (§15): `moodle_users.moodle_password` is already shown to `TUTOR` in plain text on the user ficha (documented in `docs/security.md`), so blocking it specifically in report exports/sends was inconsistent — not a broader exposure. Both the `send`/`send/test` and `export` checks in `reports.controller.ts` now only block `VIEWER`/`CONSULTOR`; the "Incluir contraseñas" checkboxes in `reports.route.tsx` and `SendReportMailModal.tsx` widened to match.
