# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is a lean index: deep detail per subsystem lives in `docs/*.md`, loaded on demand (see the map at the bottom).

## Project Overview

AcademyHub is a full-stack monorepo for training management in SMEs integrating Moodle. It handles courses, users, groups, companies, and centers, and generates regulatory compliance reports (SEPE/FUNDAE).

## Repository Structure

```
academyhub/
├── client/          # React + Vite frontend
├── server/          # NestJS backend
└── docs/            # per-subsystem documentation (read on demand)
```

## Commands

### Client (`cd client`)
```bash
npm run dev          # Start dev server (Vite, proxies /api → localhost:3000)
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint
npm test             # Vitest (all tests)
npm test -- path/to/file.spec.tsx          # Run a single test file
npx tsc -b --noEmit                        # Type-check only
```

### Server (`cd server`)
```bash
npm run start:dev    # NestJS watch mode
npm run build        # nest build
npm run lint         # ESLint --fix
npm test             # Jest (unit tests in src/**/*.spec.ts) — run from server/, NOT repo root
npm test -- auth.service.spec              # Run a single test file by pattern
npm run test:e2e     # E2E tests (test/jest-e2e.json)
npm run db:generate  # drizzle-kit generate (after schema changes)
npm run db:migrate   # drizzle-kit migrate (apply migrations)
npx tsc --noEmit -p tsconfig.json          # Type-check only
```

### Database seeding
```bash
cd server
npx ts-node seed-all.ts         # Populate all tables with sample data
npx ts-node seed-auth-users.ts  # Populate only auth users
```

## Critical conventions (apply to almost every task)

- **Keep docs current**: when a change affects an area, update that area's `docs/*.md` (and CLAUDE.md's map/conventions only if something cross-cutting changes) — compactly — before considering the task done. Add detail to the relevant `docs/*.md`, not to CLAUDE.md (keep this file a lean index). Reference docs by path, never via `@import` (eager-loads and defeats the token savings).
- **Endpoint guards**: every new controller handler must have `@Public()` (justified) or an explicit `@UseGuards(RoleGuard([...]))`. Relying on the global `AuthGuard` alone is acceptable only for read-only GET. → `docs/security.md`
- **DTO validation**: all controller inputs use class-validator DTOs; global `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields.
- **Migrations**: after editing any `schema/tables/*.table.ts`, run `npm run db:generate` then read the generated SQL and `npm run db:migrate`. Make `CREATE TABLE` idempotent if the table may already exist in prod. → `docs/architecture.md`
- **Secrets**: never return passwords/tokens to the client; SMTP password is encrypted at rest; `APP_MASTER_KEY`/`JWT_SECRET`/`DATABASE_URL`/`MOODLE_URL` are required at boot. → `docs/security.md`
- **Tests**: server = Jest (run from `server/`; `src/*` alias resolved via jest `moduleNameMapper`). client = Vitest (`*.spec.tsx`). Add tests for new logic; type-check both sides before declaring done.
- **Swagger**: only active when `NODE_ENV !== 'production'` (`/documentation` in dev).
- **Static files**: server serves `server/public/` at root; uploads go to `server/public/uploads/`.

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
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | No | Supabase Storage for mail template images |

### Client (`client/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL for local development (defaults to `http://localhost:3000`) |

## Documentation map — READ the relevant doc before working in that area

| Doc | Read it before… |
|---|---|
| `docs/architecture.md` | adding modules/tables/repositories, migrations, or scheduler tasks. Covers module wiring, the 3 user concepts (`auth_user`/`user`/`moodle_user`), `user_roles`, DB access pattern, Drizzle migration workflow, common utils. |
| `docs/security.md` | **adding any controller/endpoint**, or touching auth, guards, secrets, or org settings. Covers guards & the `@Public`/`RoleGuard` rule, CORS, JWT lifecycle, password hashing, secrets-at-rest, audit log, known items. |
| `docs/import.md` | **touching `api/import-sage/` or `api/import-velneo/`**. Covers SAGE matching/decisions, `buildUserUpdates`, `education_level`, `user_center`, `findSimilarUsers`, `file_transfer` config, `failed_user_imports`, the processing loop (no per-row tx — why). |
| `docs/mail-moodle.md` | touching `api/moodle/` or `api/mail/`, or notification/token logic. Covers Moodle integration, the token/URL resolution chain, `plugins.itop_training`, Mail system, and the `email_log`. |
| `docs/reports.md` | touching `api/reports/` (PDF templating, report rows). |
| `docs/client.md` | frontend work under `client/` (API hooks, auth flow, routing, responsive conventions, type sharing, tests). |

Memory note `project_sage_import_field_update` tracks a pending SAGE field-sync policy decision.
