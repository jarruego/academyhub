# Security

**Read before adding any controller/endpoint, or touching auth, guards, secrets, or settings.**

## Roles
`Role` enum (`src/guards/role.enum.ts`, mirrored in `client/src/hooks/api/auth/use-login.mutation.ts`): `ADMIN`, `MANAGER`, `VIEWER`, `TUTOR`, `CONSULTOR`. `TUTOR` has the exact same permissions as `VIEWER` (added as a distinct label for future differentiation) — every `RoleGuard([...])` list and `AuthzHide roles={[...]}` that includes `Role.VIEWER` also includes `Role.TUTOR`, **except** the two intentional splits below; adding a new capability to one without the other is otherwise a bug.

`CONSULTOR` is, for now, a **strict mirror of `VIEWER`** — not of `TUTOR`: every `RoleGuard([...])` list that includes `Role.VIEWER` also includes `Role.CONSULTOR` (including the two `include_passwords`/`dedication_passwords` checks below), but it is deliberately **left out** of both splits below, same as `VIEWER`. If `CONSULTOR` ever needs its own distinct permissions, split it out the same way `TUTOR` is split from `VIEWER` here, rather than special-casing it inline.

**Split 1: sending report attachments to centers (`docs/reports.md`'s "Sending Dedicación/Certificado by mail to a center").** `POST /reports/send/groups`, `POST /reports/send`, `POST /reports/send/test` are `RoleGuard([ADMIN, MANAGER, TUTOR])` — **no `VIEWER`**. The client mirrors it: `GroupUsersManager`'s "Enviar informe" button is `AuthzHide roles={[ADMIN, MANAGER, TUTOR]}`, and the center detail's "Formación en el centro" tab is omitted from `RouteTabs` items entirely for `VIEWER` (`canAccessTraining` check in `center-detail.route.tsx`). `dedication_passwords` inside that flow is further restricted to `ADMIN`/`MANAGER` only (not `TUTOR` either), same pattern as `/reports/export`'s `include_passwords`.

**Split 2: sending free-form email directly to a person (student or otherwise).** `POST /mail/send`, `POST /mail/send-from-template` are `RoleGuard([ADMIN, MANAGER, TUTOR])` — **no `VIEWER`** (`VIEWER` is read-only and shouldn't be able to email students). The client mirrors it: `GroupUsersManager`'s "Correo" button and `user-detail.tsx`'s "Enviar correo" icon button (next to the Email field) are both `AuthzHide roles={[ADMIN, MANAGER, TUTOR]}`.

**Punctual capabilities, independent of role (`auth_users.<flag>`).** Unlike the role itself, a punctual capability is a boolean flag that can be granted to *any* role (including `VIEWER`), for one narrow write action that role wouldn't otherwise have — not a new `Role` enum value. Set at auth-user edit, tab **"Permisos"** (`AuthUserFormModal.tsx`), `PUT /auth/users/:id` (`UpdateUserDTO`). Carried in the JWT payload alongside `role` (so, like a role change, it only takes effect on the user's **next login** — no refresh token to push it live). Checked inside the specific handler that cares about it (not a generic `RoleGuard` list, since it's orthogonal to role).
- `can_manage_candidates` — candidate-management access to one course edition: full edit on the **Planificación y selección** and **Candidatos** tabs, plus importing the official INAEM Preinscripciones file (see `docs/course-catalog.md`). Backend-enforced (not just client-side) on the three endpoints these tabs use, each with the guard widened to any authenticated role and the flag checked manually in the handler:
  - `PUT /course/:id` — ADMIN/MANAGER unrestricted; flag-only access is silently restricted to `COURSE_PLANNING_FIELDS` (the Planificación tab's fields, exported from `dto/course/update-course.dto.ts`) — any other field sent is dropped, not rejected, since the client's shared form always submits the whole course object.
  - `POST/DELETE/PUT(bulk) /course-candidates` — ADMIN/MANAGER/TUTOR unrestricted; flag-only access gets full candidate CRUD (no field restriction needed, the whole resource is candidate-scoped). See `CourseCandidateController.assertCanManage`.
  - `PUT /user/:id` — ADMIN/MANAGER/TUTOR unrestricted; flag-only access is silently restricted to `USER_IDENTITY_FIELDS` (`name`/`first_surname`/`second_surname`/`dni`/`phone`/`email`, exported from `dto/user/update-user.dto.ts`) — keeps sensitive fields (disability, gender-violence-victim, NSS, education level…) out of reach. Used both by inline editing in the Candidatos table and by the "combinar" action of the duplicate-match modal (`docs/course-catalog.md`).
  For the INAEM import specifically see `docs/import-inaem.md`'s "Endpoints" for the exact split (ADMIN/MANAGER unrestricted; flag-only access forced to `restrictToFileNumber` + `createMissingCourses: false`).

## Guards

| Guard | File | Scope | Behavior |
|---|---|---|---|
| `AuthGuard` | `src/guards/auth/auth.guard.ts` | Global (`APP_GUARD`) | Validates JWT Bearer token on every request; bypassed by `@Public()` |
| `ThrottlerGuard` | NestJS throttler | Global | 120 req / 60s per IP; login overridden to 8 req / 60s |
| `RoleGuard(roles[])` | `src/guards/role.guard.ts` | Per handler/controller | Checks `request.user.role` against allowed roles array |
| `@Public()` | `src/guards/auth/public.guard.ts` | Per handler/controller | Sets `IS_PUBLIC_KEY` metadata to skip `AuthGuard` |

**Rule:** every new controller handler must have either `@Public()` (justified) or an explicit `@UseGuards(RoleGuard([...]))`. Relying on the global `AuthGuard` alone is only acceptable for read-only GET endpoints.

**Public routes**: only `POST /auth/login` and `GET /api/files/organization/:filename` are decorated `@Public()`.

## CORS
Configured in `server/src/main.ts`. Production allowlist: `https://app.mecohisa.com` only. Outside production (`NODE_ENV !== 'production'`) any `http://localhost:<port>` is also accepted (Vite may pick another port if the usual one is busy). Requests without `Origin` header (server-to-server) are always allowed.

## JWT lifecycle
- **Issued** at `POST /auth/login` — payload: `{ id, username, role, jti }`
- **Secret**: `process.env.JWT_SECRET`; **expiry**: `process.env.JWT_EXPIRES_IN` (default `7d`)
- **Validated** by global `AuthGuard` on every request — also checks `revoked_tokens` table
- **Logout**: `POST /auth/logout` — inserts `jti` in `revoked_tokens`; returns 204
- **No refresh token** — rotating `JWT_SECRET` invalidates all active sessions.

## Password hashing
`scryptSync` with random salt, stored as `salt:hash` (`compareHashWithSalt`, timing-safe), in `src/utils/crypto/password-hashing.util.ts`. Legacy `hash()`/`compareHash` (SHA-256, non-timing-safe) were removed.

## Secrets at rest
- **SMTP password** is encrypted (AES-256-GCM serialized to JSON) via `secrets.util` `encryptSecretToString`/`decryptSecretFromString` (back-compat: reads legacy plaintext too). Never returned to the client — `smtp-settings.controller` masks it to `''` + a `hasPassword` flag; `MailService` reads it decrypted internally. Saving with an empty password preserves the stored one. Column widened to `text` (migration `0042`).
- **Org file-transfer password (SAGE)** is encrypted in `organization_settings.encrypted_secrets.file_transfer_password` (never stored in the `settings` JSONB, never returned to the client — only a `has_file_transfer_password` flag). The PATCH accepts it write-only inside `settings.file_transfer.password`; empty = keep stored. Legacy plaintext passwords inside `settings` are lazily migrated on the next save (readers fall back until then). See `docs/organization.md`.
- **`moodle_users.moodle_password`** is intentionally NOT encrypted — it is shown to users (welcome emails `{CLAVE_MOODLE}`, report "Clave" column).
- `APP_MASTER_KEY` (base64 AES-256, required at boot) is the key for all of the above.

## Audit log (HTTP-level)
`AuditInterceptor` (global `APP_INTERCEPTOR`, `src/interceptors/audit.interceptor.ts`) records mutating requests (POST/PUT/PATCH/DELETE) to the `audit_log` table (migration `0044`) — actor (`request.user`), method, path, route params, status, IP. Best-effort (never breaks/blocks the request) and **does not store request bodies** (avoids logging passwords/tokens). GETs and per-row import DB writes are not audited (only the originating HTTP call). It also skips `/mail/send` and `/mail/send-from-template` (`AUDIT_SKIP_PATHS`) to avoid duplicating the richer `email_log` entry; `/mail/connection` is still audited.
- Read-only query API: `GET /audit-log` (ADMIN, `api/audit/`) paginated + filterable (method/actor/date); UI at Administración → Herramientas → "Registro de auditoría" (`/tools/audit-log`).
- Email sends have their own richer log — see `email_log` in `docs/mail-moodle.md`.
- **User merge** (`api/user-merge/`, ADMIN, destructive) has no dedicated log: it relies on this `audit_log`, passing `winnerId`/`loserId` in the route so they land in `target`/`path`. The operation is irreversible (loser hard-deleted, no snapshot). See `docs/user-merge.md`.

## Known open security items
- **Contraseñas sin complejidad**: only `MinLength(8)` enforced; no uppercase/number/special char requirement.
- JWT is stored in `localStorage` on the client (XSS exposure) — accepted for now.
