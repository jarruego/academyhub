# Security

**Read before adding any controller/endpoint, or touching auth, guards, secrets, or settings.**

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
