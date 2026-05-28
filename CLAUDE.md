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
npm run dev          # Start dev server (Vite)
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint
npm test             # Vitest
```

### Server (`cd server`)
```bash
npm run start:dev    # NestJS watch mode
npm run build        # nest build
npm run lint         # ESLint --fix
npm test             # Jest (unit tests in src/**/*.spec.ts)
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
- `AppModule` — root, registers global `ThrottlerGuard` (120 req/min) and `AuthGuard` (JWT Bearer on all routes except `@Public()`)
- `DatabaseModule` — global, provides `DATABASE_PROVIDER` token (a `DatabaseService` wrapping a Drizzle + `pg.Pool` instance)
- `ApiModule` — aggregates all feature modules: Company, Center, Course, Group, User, Moodle, MoodleUser, ImportSage, ImportVelneo, Reports, Organization, Files, Mail
- `AuthModule` — login endpoint, issues JWT; `auth_user` table is separate from the main `user` table
- `SchedulerModule` — internal cron scheduler using `node-cron`; each task implements `ScheduledTask` interface

### Three distinct user concepts
- **`auth_user`** — login credentials (`username`, `password` (scrypt+salt), `role`). Roles: `admin`, `manager`, `viewer`. Optionally holds a per-user `moodleToken` that overrides the org-level token.
- **`user`** — training domain users (students/employees). Linked to courses via `user_course`, to groups via `user_group`, to centers via `user_center`. Can optionally be linked to a `moodle_user` via `moodle_user_auth_user`.
- **`moodle_user`** — a Moodle platform user record, synced from Moodle. The `moodle_user_auth_user` table is a many-to-many bridge between `auth_user` and `moodle_user`.

### `user_roles` table
A lookup catalog of role definitions (`role_shortname`, `role_description`) used during Velneo imports to label roles within groups/courses. Not the same as `auth_user.role`.

### Database access pattern
All DB access goes through repositories in `server/src/database/repository/`. Each repository receives the `DATABASE_PROVIDER` injection token and calls `db.select(...)`, `db.insert(...)`, etc. using Drizzle ORM. Schema is defined in `server/src/database/schema/tables/*.table.ts` and re-exported from `server/src/database/schema.ts`.

### Drizzle migrations
Migration files live in `server/drizzle/`. After modifying any table file under `schema/tables/`, run `npm run db:generate` then `npm run db:migrate`. The `unaccent` and `pg_trgm` PostgreSQL extensions must exist before the first migration (requires superuser).

### Moodle integration
`MoodleService` (`server/src/api/moodle/moodle.service.ts`) wraps all Moodle Web Services calls. The org-level Moodle token is stored encrypted in `organization_settings` (via `secrets.util.ts`) and can be overridden per `auth_user.moodleToken`. The optional custom plugin `block_advanced_reports_get_userstats` is gated by `organization_settings.settings.plugins.itop_training`.

**Token resolution:** `process.env.MOODLE_TOKEN` is a legacy fallback that may not be set in production. The real org-level token lives in `organization_settings.encrypted_secrets` and must be read via `MoodleService.resolveMoodleToken()` (public method). For Moodle notification sending, `MailService.resolveToken()` implements the full priority chain:
1. `moodle_user_auth_user.moodle_token` — token específico del vínculo (par `auth_user` + `moodle_user`), se toma el de mayor `id` si hay varios
2. `auth_user.moodleToken` — fallback por usuario autenticado
3. `MoodleService.resolveMoodleToken()` — token global de organización (predeterminado cuando `moodleSenderChoice = 'default'`)

### Import flows
- **SAGE** (`api/import-sage/`): The active import path. Parses a CSV (uploaded manually or fetched via SFTP/FTP) and upserts users+companies. Uses a **decision workflow**: each run creates an `import_job` with `import_decisions` rows requiring human review before committing (matches by DNI/email/name using Levenshtein distance).
- **Velneo** (`api/import-velneo/`): Legacy one-time migration tool used during initial data load. Processes a full Velneo ERP CSV dump in phases (users → companies → associate → courses → groups). Not actively maintained.

### Scheduler
Internal cron scheduler; tasks in `server/src/scheduler/tasks/`. Controlled via env vars:
- `ENABLE_CRON_SCHEDULER=true` — master switch
- Each task has its own `TASK_ENABLED` and `TASK_CRON` env vars
- Designed for single-instance deployments only

## Client Architecture

### API communication
- `getApiHost()` (`client/src/utils/api/get-api-host.util.ts`) — returns `VITE_API_URL` in dev, or the hardcoded Render URL in production
- `useAuthenticatedAxios()` — hook that returns an Axios caller pre-configured with `Authorization: Bearer <token>`
- All data-fetching hooks live under `client/src/hooks/api/` and use TanStack Query

### Auth flow
`AuthProvider` (`client/src/providers/auth/auth.provider.tsx`) persists `{ token, user }` to `localStorage` under the key `"userInfo"`. On mount it reads it back via `readUserInfo()`. `useAuthInfo()` exposes the context; `useRole()` extracts the role. Routes check role to show/hide menu items. All protected routes are guarded on the server side by the global `AuthGuard`.

### Routing
`client/src/router.tsx` defines all routes. The sidebar is role-aware: Reports is visible to `admin`, `manager`, and `viewer`; the Administración sub-menu (Organization, SMTP, Tools) is only visible to `admin`.

### Type sharing
Shared types between components and hooks live in `client/src/shared/types/`. Component-level types stay in `client/src/types/`. Zod schemas for form validation are in `client/src/schemas/`.

## Environment Variables

### Server (`server/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiry (default `7d`) |
| `MOODLE_TOKEN` | Yes | Moodle API token |
| `MOODLE_URL` | Yes | Moodle API base URL |
| `DB_SSL` | No | Set `true` for SSL (auto-enabled in production) |
| `DB_POOL_MAX` | No | PG pool size (default `10`) |
| `ENABLE_CRON_SCHEDULER` | No | `true` to enable internal cron |
| `SCHEDULER_TIMEZONE` | No | Cron timezone (default `UTC`) |
| `SFTP_SAGE_*` | No | SFTP credentials for SAGE import |

### Client (`client/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL for local development (defaults to `http://localhost:3000`) |

## Key Conventions

- **Password hashing**: `scryptSync` with random salt, stored as `salt:hash`. Never use the legacy `hash()` (SHA-256) for new passwords.
- **Public routes**: Decorate controller methods with `@Public()` to bypass the global `AuthGuard`.
- **DTO validation**: All controller inputs use class-validator DTOs. `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields globally.
- **Swagger**: Available at `http://localhost:3000/documentation` in dev.
- **Static files**: Server serves `server/public/` at root; uploaded files go to `server/public/uploads/`.
