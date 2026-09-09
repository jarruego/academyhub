# Permissions matrix (role × action)

**Read this before adding/removing/changing any `RoleGuard([...])`, `AuthzHide roles={[...]}`, inline role check, or punctual capability flag (`auth_users.<flag>`).** This file — together with `client/src/components/auth-users/permissions-matrix.content.ts` (the same data, curated for the in-app panel) — is the maintained registry CLAUDE.md's "Critical conventions" points to. Update **both** whenever a permission changes; they must never drift apart. The in-app panel (Gestión de usuarios → "Ver matriz de permisos por rol", ADMIN-only, `PermissionsMatrixPanel.tsx`) renders the `.content.ts` file directly, so editing that file is what actually changes what ADMIN sees — this `.md` file is the fuller, endpoint-level reference for developers.

Roles: `ADMIN`, `MANAGER`, `VIEWER`, `TUTOR`, `CONSULTOR` (`docs/security.md`'s "## Roles" — read it first for what "split" means and the two/three documented ones). ✅ = has access · ❌ = no access · **flag** = only via the punctual `can_manage_candidates` flag (`docs/security.md`) regardless of role.

Initial audit: 2026-09-09. Scope note: a GET with **no guard at all** (neither class- nor method-level) is reachable by any of the 5 roles via the global `AuthGuard` alone — noted per-row as "no guard" where it matters (mostly reference/lookup GETs).

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
| View SMTP settings (password always masked) | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Save SMTP settings / test connection | ✅ | ❌ | ❌ | ❌ | ❌ | |
| `/organization/smtp` screen | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ see "Open items" #3 — `MailConfigTab.tsx` has no role gating at all |
| View mail templates | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Create/edit/delete template, upload image | ✅ | ❌ | ❌ | ❌ | ❌ | |
| `/organization/mail-templates` screen | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ same as above — `MailTemplatesTab.tsx` |

## 3. Import SAGE

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Upload CSV/FTP, decisions, jobs, failed users | ✅ | ✅ | ❌ | ❌ | ❌ | Class-level `[ADMIN, MANAGER]` |
| Clear old jobs / recover interrupted / bulk-delete failed | ✅ | ❌ | ❌ | ❌ | ❌ | Extra method-level `[ADMIN]` |
| `/tools/import-sage` screen | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ see "Open items" #1 — MANAGER has full server access but no UI path at all |

## 4. Import INAEM (general tool)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Import Acciones / Alumnos | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Import Preinscripciones, unrestricted | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Import Preinscripciones, **scoped to one edition** | — | — | flag | flag | flag | `restrictToFileNumber` + `createMissingCourses: false`; see `docs/import-inaem.md` |
| Job status, per-user/course preinscripciones, enrolled count | ✅ | ✅ | flag | flag | flag | |
| Delete a course's preinscripciones | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Conflicts (list/resolve/delete) | ✅ | ✅ | ❌ | ❌ | ❌ | |
| `/tools/import-inaem` screen | ✅ | ✅ | ❌ | ❌ | ❌ | Client matches server |
| "Importar Preinscritos INAEM" button (edition ficha) | ✅ | ✅ | flag | flag | flag | `course-candidates-section.tsx` |

## 5. Mail / Moodle sync

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| `POST /mail/send`, `/mail/send-from-template` | ✅ | ✅ | ❌ | ✅ | ❌ | **Split 1** (`docs/security.md`) — "Correo" button |
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

**Split 3: candidate/interest management inside a course edition.** `POST/DELETE/PUT(bulk) /course-candidates` and the equivalent `course-interests` writes are `RoleGuard([ADMIN, MANAGER, TUTOR])` — `TUTOR` gets full write access here **without** needing `can_manage_candidates`, same as `VIEWER`/`CONSULTOR` do need it. Not previously documented alongside Split 1/2 in `docs/security.md`; folded in there now. The client mirrors it: `course-detail.route.tsx`'s `canEditCandidates = [ADMIN, MANAGER, TUTOR].includes(role) || canManageCandidates`.

## 10. Course Requests (Peticiones de centros)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| View requests, report, PDF, detail | ✅ | ✅ | ✅ | ✅ | ✅ | Class-level 5-role guard |
| Create/edit/duplicate/close/reopen/delete, upload Excel, assign/release students | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ see "Open items" #6 — unlike §9, `TUTOR` does **not** get write access here |

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
| Create company/center | ✅ | ❌ | ❌ | ❌ | ❌ | |
| Edit company/center | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ see "Open items" #4 — client shows the form/save button to MANAGER too, server 403s it |
| Bulk-update users' main center | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Delete company/center, add/edit/delete user in center | ✅ | ❌ | ❌ | ❌ | ❌ | |
| View company/center, list, center's users | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| "Formación en el centro" tab | ✅ | ✅ | ❌ | ✅ | ❌ | Split 1 |

## 14. Usuarios (personas)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| Create user, import from Moodle, bulk enroll/edit | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Edit user (full ficha) | ✅ | ✅ | ❌ | ✅ | ❌ | `hasFullAccess = [ADMIN, MANAGER, TUTOR]` |
| Edit user — **identity fields only** | — | — | flag | (already full access) | flag | `USER_IDENTITY_FIELDS`; quick-add / duplicate-merge flows |
| View/list users, a user's centers/courses, certificate | ✅ | ✅ | ✅ | ✅ | ✅ | No guard |
| Delete user | ✅ | ❌ | ❌ | ❌ | ❌ | |
| "Crear usuario" button (listing) | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ see "Open items" #7 — `POST /user` itself is `[ADMIN, MANAGER]` |
| `/create-user` page | ✅ | ✅ | ❌ | ❌ | ❌ | Only its "Combinar con existente" action is further `AuthzHide[ADMIN]` |
| "Enviar correo" icon (user ficha) | ✅ | ✅ | ❌ | ✅ | ❌ | Split 2 |

## 15. Reports (Informes)

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR | Notes |
|---|---|---|---|---|---|---|
| List reports, roles, facets | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Export PDF/Excel | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Export **with passwords** (`include_passwords`) | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Send report to centers (`send/groups`, `send`, `send/test`) | ✅ | ✅ | ❌ | ✅ | ❌ | **Split 1** |
| Send report **with passwords** (`dedication_passwords`) | ✅ | ✅ | ❌ | ❌ | ❌ | Inside Split 1's own guard, `TUTOR` is blocked here too — see "Open items" #8 |
| "Incluir contraseñas" checkbox | ✅ | ✅ | ❌ | ❌ | ❌ | |

## 16. User Merge / User Sanitization

| Action | ADMIN | MANAGER | VIEWER | TUTOR | CONSULTOR |
|---|---|---|---|---|---|
| Duplicate merge (candidates, preview, execute) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Data sanitization (issues, fix, fix-all) | ✅ | ❌ | ❌ | ❌ | ❌ |

Both class-level `[ADMIN]`.

---

## Open items found by the 2026-09-09 audit (not yet fixed — flagged for a decision)

1. **SAGE import: MANAGER has full server access but zero UI path.** `SageImport.tsx` wraps the whole page in `AuthzHide[ADMIN]`, and the Herramientas nav/index is also ADMIN-only.
2. **INAEM import (general tool): only reachable by MANAGER via a typed-in URL.** The component itself is correctly `[ADMIN, MANAGER]`, but nothing in the nav points MANAGER to `/tools/import-inaem`.
3. **`/organization/smtp` and `/organization/mail-templates` have no client-side role gating at all.** Any authenticated role (including VIEWER/CONSULTOR) can view the SMTP form (password masked) and the template manager; the server correctly blocks the mutating calls, but the read-only exposure isn't intentional-looking compared to every other Administración screen.
4. **Empresas/Centros: client is more permissive than server.** `company-detail.route.tsx`/`center-detail.route.tsx` compute `canEdit = [ADMIN, MANAGER]` and show an editable form + "Guardar" to MANAGER, but `PUT /company/:id` and `PUT /center/:id` are ADMIN-only server-side — MANAGER gets a 403 on save. The only place in the whole audit where the client is laxer than the server (everywhere else it's the reverse or they match); the bulk `users-main-center` endpoint already allows MANAGER, suggesting the intent was to widen `update`/`create` too rather than that the client is wrong.
5. *(folded into Split 3 above, not a separate open item.)*
6. **Inconsistent criterion between three sibling modules.** Candidatos and Interesados (§9) give `TUTOR` write access; Course Requests (§10), same guard shape (class-level 5-role + method-level `[ADMIN, MANAGER]`), does not. No comment anywhere explains why.
7. **"Crear usuario" button hidden from MANAGER despite `POST /user` allowing it.** `users.route.tsx`'s button is `AuthzHide[ADMIN]`; MANAGER can still create a user by navigating straight to `/create-user`.
8. **`dedication_passwords` excludes `TUTOR` inside Split 1's own guard.** Likely intentional (same criterion as `include_passwords` on export), but not called out as such next to Split 1 in `docs/security.md`.

None of these have been changed as part of this audit — they're recorded here so a deliberate decision can be made per item (keep as-is vs. widen one side to match the other) rather than drifting further unnoticed.
