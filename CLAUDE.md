# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AcademyHub is a full-stack monorepo for training management in SMEs integrating Moodle. It handles courses, users, groups, companies, and centers, and generates regulatory compliance reports (SEPE/FUNDAE).

## Repository Structure

```
academyhub/
├── client/          # React + Vite frontend
└── server/          # NestJS backend
```

## Commands

### Client (`cd client`)
```bash
npm run dev          # Start dev server (Vite, proxies /api → localhost:3000)
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint
npm test             # Vitest (all tests)
npm test -- path/to/file.spec.tsx          # Run a single test file
npm test -- --reporter=verbose             # Verbose output
```

### Server (`cd server`)
```bash
npm run start:dev    # NestJS watch mode
npm run build        # nest build
npm run lint         # ESLint --fix
npm test             # Jest (unit tests in src/**/*.spec.ts)
npm test -- auth.service.spec              # Run a single test file by pattern
npm run test:e2e     # E2E tests (test/jest-e2e.json)
npm run db:generate  # drizzle-kit generate (after schema changes)
npm run db:migrate   # drizzle-kit migrate (apply migrations)
```

### Database seeding
```bash
cd server
npx ts-node seed-all.ts         # Populate all tables with sample data
npx ts-node seed-auth-users.ts  # Populate only auth users
```

## Server Architecture

### Module hierarchy
- `AppModule` — root, registers global `ThrottlerGuard` (120 req/min per IP) and `AuthGuard` (JWT Bearer on all routes except `@Public()`). JSON body limit is 1 MB; file uploads use Multer (no limit shared).
- `DatabaseModule` — global, provides `DATABASE_PROVIDER` token (a `DatabaseService` wrapping a Drizzle + `pg.Pool` instance)
- `ApiModule` — aggregates all feature modules: Company, Center, Course, Group, User, AuthUser, Moodle, MoodleUser, ImportSage, ImportVelneo, Reports, Organization, Files, Mail, UserRoles
- `AuthModule` — login/logout endpoints, issues JWT; `auth_user` table is separate from the main `user` table
- `SchedulerModule` — internal cron scheduler using `node-cron`; each task implements `ScheduledTask` interface

### Three distinct user concepts
- **`auth_user`** — login credentials (`username`, `password` (scrypt+salt), `role`). Roles: `admin`, `manager`, `viewer`. Optionally holds a per-user `moodleToken` that overrides the org-level token.
- **`user`** — training domain users (students/employees). Linked to courses via `user_course`, to groups via `user_group`, to centers via `user_center`. Can optionally be linked to a `moodle_user` via `moodle_user_auth_user`.
- **`moodle_user`** — a Moodle platform user record, synced from Moodle. Its `id_user` FK references the `user` table (domain user), **not** `auth_user`. The `moodle_user_auth_user` table is a many-to-many bridge between `auth_user` and `moodle_user`; each row has its own `moodle_token` field.

### `user_roles` table
A lookup catalog of role definitions (`role_shortname`, `role_description`) used during Velneo imports to label roles within groups/courses. Not the same as `auth_user.role`.

### Database access pattern
All DB access goes through repositories in `server/src/database/repository/`. Each repository receives the `DATABASE_PROVIDER` injection token and calls `db.select(...)`, `db.insert(...)`, etc. using Drizzle ORM. Schema is defined in `server/src/database/schema/tables/*.table.ts` and re-exported from `server/src/database/schema.ts`.

The base `Repository` class (`src/database/repository/repository.ts`) exposes `dbService`, a `query()` method (uses an active transaction if one is passed), and a `transaction()` wrapper. Pass a transaction object through service calls to make multiple repository operations atomic.

Key junction tables: `user_center`, `user_course`, `user_group`, `moodle_user_auth_user`. Most domain tables have an `organization_id` FK (single-org in practice but schema supports multi-tenancy).

### Drizzle migrations
Migration files live in `server/drizzle/`. After modifying any table file under `schema/tables/`, run `npm run db:generate` then `npm run db:migrate`. The `unaccent` and `pg_trgm` PostgreSQL extensions must exist before the first migration (requires superuser).

### Moodle integration
`MoodleService` (`server/src/api/moodle/moodle.service.ts`) wraps all Moodle Web Services calls. The org-level Moodle token is stored encrypted in `organization_settings` (via `secrets.util.ts`) and can be overridden per `auth_user.moodleToken`. The optional custom plugin `block_advanced_reports_get_userstats` is gated by `organization_settings.settings.plugins.itop_training`.

**Token resolution:** `process.env.MOODLE_TOKEN` is a legacy fallback that may not be set in production. The real org-level token lives in `organization_settings.encrypted_secrets`, read via `MoodleService.resolveMoodleToken()`. `MailService.resolveToken()` implements the full priority chain for notifications:
1. `moodle_user_auth_user.moodle_token` — link-specific token for the `auth_user`+`moodle_user` pair (highest `id` wins if several)
2. `auth_user.moodleToken` — per-authenticated-user fallback
3. `MoodleService.resolveMoodleToken()` — org-level token (default when `moodleSenderChoice = 'default'`)

Only implemented in `MailService.resolveToken()` — other call sites must replicate it manually; no shared helper exists yet.

### Mail system
Mail templates are stored in the database (`mail_templates` table). Template images are stored in Supabase Storage (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` env vars). `MailService` sends Moodle notifications using the token resolution chain above.

`POST /mail/send` and `POST /mail/send-from-template` accept a `moodleSenderChoice` parameter (`'default'` | `'auth'` | `'tutor'`) that selects which Moodle token is used. See `MailService.resolveToken()` for the full logic.

`MailModule` imports `MoodleModule` (for `MoodleService`). Avoid creating a reverse import from `MoodleModule` into `MailModule` — it would create a circular dependency.

### Reports system
PDF generation uses `ReportsPdfService` backed by `ReportRenderer` (`src/api/reports/report-renderer.service.ts`). Templates are JSON files in `src/api/reports/templates/*.json` that declare pages, element types (`title`, `paragraph`, `table`, `image`), styles, and `{{variable}}` placeholders filled at render time. `renderTemplate()` streams a PDF to a response; `renderTemplateIntoDocument()` writes into an existing PDFKit doc for multi-template composition. `PdfService` (`src/common/pdf/pdf.service.ts`) is the shared PDFKit wrapper.

### Import flows
- **SAGE** (`api/import-sage/`): Active import path. Semicolon-delimited CSV (uploaded manually or via SFTP); **may arrive unordered**. Each run creates an `import_job`; rows processed sequentially. Key CSV fields: `[1]` center code, `[2]` center name, `[3]` employee code, `[4]` DNI, `[5]` name, `[6]` surnames, `[7]` start_date, `[8]` end_date, `[10]` email, `[14]` NSS, `[17]` company name, `[18]` company CIF.

  **Match order per row:** DNI exact → NSS conflict → name similarity ≥0.9 (Levenshtein) → create new user. When a match is ambiguous, creates an `import_decision` for manual review; **center assignment is skipped until the decision is resolved**.

  **`buildUserUpdates` policy:** fill-gaps-only — only fills fields that are empty in DB, never overwrites. `name`/`first_surname`/`second_surname`/`dni` are never updated for existing users. Exception: `gender` (CSV `Sexo`: 1=Male, 2=Female) treats `'Other'` (the column default) as "unknown" and fills it. `SageImportOptions` (`overwriteGender`, `overwriteSalaryGroup` — checkboxes in both the manual upload and FTP import screens; sent as form fields in the multipart endpoint, hence the `@Transform` string→boolean in the DTOs) forces the CSV value over any existing one for that field only. (May change in future to always sync some fields from SAGE — see [[project_sage_import_field-update]].)

  **`user_center`:** one record per user+center pair (no history). `is_main_center` is recalculated by `ensureMainCenter()` after each row: if current main is still active (`end_date IS NULL`) it is never overwritten (protects manual assignments); otherwise among active records the **oldest** `start_date` wins; if all closed, highest `end_date`. During an import, `user_center` is read from an in-memory write-through cache (`userCenterCache`, null outside imports — DB fallback); any new code writing `user_center` mid-import must update it. `ImportModule.onModuleInit()` cleans up jobs stuck in `PROCESSING` on startup.
- **Velneo** (`api/import-velneo/`): Legacy one-time migration tool used during initial data load. Processes a full Velneo ERP CSV dump in phases (users → companies → associate → courses → groups). Not actively maintained. The upload endpoint requires `ADMIN` role (`@UseGuards(RoleGuard([Role.ADMIN]))`).

### Scheduler
Internal cron scheduler; tasks in `server/src/scheduler/tasks/`. Active tasks:
- `moodle-active-progress.task.ts` — syncs active course progress from Moodle
- `sage-import.task.ts` — automated SAGE CSV import from SFTP

Controlled via env vars:
- `ENABLE_CRON_SCHEDULER=true` — master switch
- `SAGE_IMPORT_ENABLED` / `SAGE_IMPORT_CRON` — SAGE CSV import (default: enabled, `0 2 * * *`)
- `MOODLE_ACTIVE_SYNC_ENABLED` / `MOODLE_ACTIVE_SYNC_CRON` — progress sync (default: disabled, `0 4 * * *`)
- Designed for single-instance deployments only

### Common utilities
- `src/utils/crypto/secrets.util.ts` — AES encryption/decryption for org-level secrets (Moodle token)
- `src/utils/crypto/password-hashing.util.ts` — scrypt password hashing
- `src/common/pdf/pdf.service.ts` — shared PDF generation
- `src/common/storage/supabase-storage.service.ts` — Supabase Storage for mail template images
- `src/common/utils/dayjs-tz.ts` — timezone-aware date handling (used by scheduler and reports)

## Client Architecture

### API communication
- `getApiHost()` (`client/src/utils/api/get-api-host.util.ts`) — returns `VITE_API_URL` in dev, or the hardcoded Render URL in production
- Vite proxies `/api` → `http://localhost:3000` in dev (configured in `vite.config.ts`)
- `useAuthenticatedAxios()` — hook that returns an Axios caller pre-configured with `Authorization: Bearer <token>`
- All data-fetching hooks live under `client/src/hooks/api/` and use TanStack Query

### Hooks pattern
Each domain under `client/src/hooks/api/` has separate `.query.ts` and `.mutation.ts` files. Queries use `useSuspenseQuery` or `useQuery`; mutations use `useMutation` with `onSuccess` invalidating related queries. Query keys follow a hierarchical array pattern: `["resource", ...filters]` (e.g., `["moodle-links", authUserId]`). Errors are typed as `AxiosError<ApiErrorDto>`.

### Auth flow
`AuthProvider` (`client/src/providers/auth/auth.provider.tsx`) persists `{ token, user }` to `localStorage` under the key `"userInfo"`. On mount it reads it back via `readUserInfo()`. `useAuthInfo()` exposes the context; `useRole()` extracts the role. Routes check role to show/hide menu items. All protected routes are guarded on the server side by the global `AuthGuard`. Use `<AuthzHide roles={[Role.ADMIN]}>` (`client/src/components/permissions/authz-hide.tsx`) to conditionally render UI elements based on role.

### Routing
`client/src/router.tsx` defines all routes and the top-level layout. The sidebar is role-aware: Reports is visible to `admin`, `manager`, and `viewer`; the Administración sub-menu (Organization, SMTP, Tools) is only visible to `admin`.

**Responsive sidebar:** breakpoint is `md` (768 px). On `md+` a persistent `<Sider>` is rendered. Below `md` the Sider is replaced by a `<Header>` with a hamburger button that opens a `<Drawer>`. Use `screens.md === false` (not `!screens.md`) to detect mobile — avoids a flash on first render when `useBreakpoint` hasn't resolved yet. Drawer closes when any leaf `<Link>` is clicked; the Administración sub-menu can expand/collapse without closing the drawer because `onClick={onClose}` is placed on the `<Link>` nodes, not on the `<Menu>`.

### Responsive design conventions

**Form layouts:** replace `<div style={{ display: 'flex', gap: 16 }}>` with `<Row gutter={[16, 0]}>` + `<Col xs={24} sm={X} md={Y}>`. Never use hardcoded pixel widths on `<Form.Item>` — let the `<Col>` control the width. `<DatePicker>` and `<Select>` inside a Col need `style={{ width: '100%' }}` to fill their column.

**Wide tables:** add `scroll={{ x: 'max-content', y: N }}` and pin key columns with `fixed: 'left'`. Fixed columns must be contiguous from the left edge.

**Table navigation:** main list tables (`users`, `groups`, `courses`, `companies`, `centers`) use `onClick` on `onRow` for single-click navigation. Tables inside detail pages keep `onDoubleClick` to avoid conflicts with row selection.

### Type sharing
Shared types between components and hooks live in `client/src/shared/types/`. Component-level types stay in `client/src/types/`. Zod schemas for form validation are in `client/src/schemas/` (currently only Spanish DNI and CIF validators; form schemas are co-located with their route components).

## Environment Variables

### Server (`server/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiry (default `7d`) |
| `MOODLE_TOKEN` | No | Legacy fallback Moodle token (may not be set in production) |
| `MOODLE_URL` | Yes | Moodle API base URL |
| `PORT` | No | HTTP port (default `3000`) |
| `DB_SSL` | No | Set `true` for SSL (auto-enabled in production) |
| `DB_POOL_MAX` | No | PG pool size (default `10`) |
| `ENABLE_CRON_SCHEDULER` | No | `true` to enable internal cron |
| `SCHEDULER_TIMEZONE` | No | Cron timezone (default `UTC`) |
| `APP_MASTER_KEY` | Yes | Base64 AES-256 key for encrypting secrets at rest. Generate with `openssl rand -base64 32`. |
| `SFTP_SAGE_*` | No | SFTP credentials for SAGE import |
| `SUPABASE_URL` | No | Supabase project URL (mail template images) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `SUPABASE_STORAGE_BUCKET` | No | Supabase bucket name for mail images |

### Client (`client/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL for local development (defaults to `http://localhost:3000`) |

## Key Conventions

- **Password hashing**: `scryptSync` with random salt, stored as `salt:hash`. Never use the legacy `hash()` (SHA-256) for new passwords.
- **Public routes**: only `POST /auth/login` and `GET /api/files/organization/:filename` are decorated `@Public()` (see Guards table below for mechanics).
- **DTO validation**: All controller inputs use class-validator DTOs. `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields globally.
- **Swagger**: Only active when `NODE_ENV !== 'production'` (`http://localhost:3000/documentation` in dev).
- **Static files**: Server serves `server/public/` at root; uploaded files go to `server/public/uploads/`.
- **Client tests**: Vitest with `happy-dom` environment. Test files are co-located with routes/components as `*.spec.tsx`.

## Security Architecture

### Guards

| Guard | File | Scope | Behavior |
|---|---|---|---|
| `AuthGuard` | `src/guards/auth/auth.guard.ts` | Global (`APP_GUARD`) | Validates JWT Bearer token on every request; bypassed by `@Public()` |
| `ThrottlerGuard` | NestJS throttler | Global | 120 req / 60s per IP; login overridden to 8 req / 60s |
| `RoleGuard(roles[])` | `src/guards/role.guard.ts` | Per handler/controller | Checks `request.user.role` against allowed roles array |
| `@Public()` | `src/guards/auth/public.guard.ts` | Per handler/controller | Sets `IS_PUBLIC_KEY` metadata to skip `AuthGuard` |

**Rule:** every new controller handler must have either `@Public()` (justified) or an explicit `@UseGuards(RoleGuard([...]))`. Relying on the global `AuthGuard` alone is only acceptable for read-only GET endpoints.

### CORS

Configured in `server/src/main.ts` with an explicit origin allowlist: `localhost:5173`, `localhost:4173`, `https://app.mecohisa.com`. Requests without `Origin` header (server-to-server) are always allowed.

### JWT lifecycle

- **Issued** at `POST /auth/login` — payload: `{ id, username, role, jti }`
- **Secret**: `process.env.JWT_SECRET`; **expiry**: `process.env.JWT_EXPIRES_IN` (default `7d`)
- **Validated** by global `AuthGuard` on every request — also checks `revoked_tokens` table
- **Logout**: `POST /auth/logout` — inserts `jti` in `revoked_tokens`; returns 204
- **No refresh token** — rotating `JWT_SECRET` invalidates all active sessions.

### Known open security items

- **No audit log**: sensitive operations (user create/delete, imports, role changes) are not logged to a persistent audit table.
- **Contraseñas sin complejidad**: only `MinLength(8)` enforced; no uppercase/number/special char requirement.
