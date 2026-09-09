# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is a lean index: deep detail per subsystem lives in `docs/*.md`, loaded on demand (see the map at the bottom).

## 🤖 AI Agent Routing Rules (CRITICAL)
- **Claude Code (Target):** Eagerly leverage this file as an index. Read full `docs/*.md` sub-systems on-demand as per the documentation map below.
- **OpenAI / Codex / Custom Agents (Target):** DO NOT automatically scan or read the `docs/` directory. Stop. Wait for explicit user instructions specifying which exact file path to read. Avoid massive multi-file token ingestion.

## Project Overview

AcademyHub is a full-stack monorepo for training management in SMEs integrating Moodle. It handles courses, users, groups, companies, and centers, and generates regulatory compliance reports (SEPE/FUNDAE).

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
- **Permissions matrix**: whenever you add, remove, or change a `RoleGuard`, an `AuthzHide`, an inline role check, or a punctual capability flag (`auth_users.<flag>`), update **both** `docs/permissions-matrix.md` and `client/src/components/auth-users/permissions-matrix.content.ts` (the same registry rendered in-app at Gestión de usuarios → "Ver matriz de permisos por rol", ADMIN-only) — they must never drift apart. → `docs/permissions-matrix.md`
- **DTO validation**: all controller inputs use class-validator DTOs; global `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields.
- **Migrations**: after editing any `schema/tables/*.table.ts`, run `npm run db:generate` then read the generated SQL and `npm run db:migrate`. Make `CREATE TABLE` idempotent if the table may already exist in prod. → `docs/architecture.md`
- **Secrets**: never return passwords/tokens to the client; SMTP password is encrypted at rest; `APP_MASTER_KEY`/`JWT_SECRET`/`DATABASE_URL`/`MOODLE_URL` are required at boot. → `docs/security.md`
- **Tests**: server = Jest (run from `server/`; `src/*` alias resolved via jest `moduleNameMapper`). client = Vitest (`*.spec.tsx`). Add tests for new logic; type-check both sides before declaring done.
- **Swagger**: only active when `NODE_ENV !== 'production'` (`/documentation` in dev).
- **Static files**: server serves `server/public/` at root; uploads go to `server/public/uploads/`.
- **Table/link navigation**: any new list row or detail link goes through `useLinkNavigation()`/`DataTable`'s `getRowUrl` (click = same tab, double-click = new tab) — never wire `window.open`/`target="_blank"` by hand for an internal route. → `docs/client.md`

## Environment Variables

Full variable list with descriptions lives in `server/.env.example` and `client/.env.example` (each var is commented there). Vars required at boot are already listed under Critical conventions above.

Two vars aren't documented in `.env.example` (code defaults only):
- `DB_SSL` — set `true` for SSL (auto-enabled in production).
- `DB_POOL_MAX` — PG pool size (default `10`).

Prod gotcha (Render): `SCHEDULER_TIMEZONE` + `SAGE_IMPORT_CRON` must be set in the dashboard — they override the code defaults.

## Documentation map — READ the relevant doc before working in that area

| Doc | Read it before… |
|---|---|
| `docs/architecture.md` | adding modules/tables/repositories, migrations, or scheduler tasks. Covers module wiring, the 3 user concepts (`auth_user`/`user`/`moodle_user`), `user_roles`, the course typology axes (`modality`/`client`/`funding`, ámbito derived from funding), the active-state model (group `active_mode`/dates → derived course active), DB access pattern, Drizzle migration workflow, common utils. |
| `docs/security.md` | **adding any controller/endpoint**, or touching auth, guards, secrets, or org settings. Covers guards & the `@Public`/`RoleGuard` rule, CORS, JWT lifecycle, password hashing, secrets-at-rest, audit log, known items. |
| `docs/permissions-matrix.md` | **touching any `RoleGuard`/`AuthzHide`/role check, or a punctual capability flag** anywhere in the app. The full role × action inventory (per area, endpoint-level) — keep it and its in-app counterpart (`permissions-matrix.content.ts`, rendered in Gestión de usuarios) in sync with every change. |
| `docs/organization.md` | **touching `api/organization/`**, the org settings screen, or any consumer of `organization_settings`. Covers the typed settings model (`organization-settings.model.ts`, `normalizeOrganizationSettings` — the only way to read the JSONB), nested-DTO validation, encrypted secrets (`file_transfer_password` write-only + lazy migration, merge semantics), endpoints, and the sectioned RHF+Zod settings form. |
| `docs/import.md` | **touching `api/import-sage/`**. Covers SAGE matching/decisions, `buildUserUpdates`, `education_level`, `user_center`, `findSimilarUsers`, `file_transfer` config, `failed_user_imports`, the processing loop (no per-row tx — why). |
| `docs/import-inaem.md` | **touching `api/import-inaem/`** (INAEM import: acciones/alumnos/preinscripciones). Covers the 3 source files (HTML-table `.xls` + `.xlsx`), `course.file_number`/`client`/`is_provisional`, `user_group.finalized`, the `user_preinscription` table, parsers, fill-gaps + conflict decisions, education-level mapping, endpoints, and client surfaces. |
| `docs/mail-moodle.md` | touching `api/moodle/` or `api/mail/`, or notification/token logic. Covers Moodle integration, the token/URL resolution chain, `plugins.itop_training`, Mail system, and the `email_log`. |
| `docs/forum-duplicator.md` | **touching `api/forum/`** or the forum WS methods in `MoodleService`. Covers the "Duplicado de Foros" tool: replicate a model forum discussion to all groups (one per group), authorship = each group's tutor (per-group WS token via `findGroupTutors`), copy text+inline media, idempotent by subject, required Moodle WS functions, and the phased plan. |
| `docs/user-merge.md` | **touching `api/user-merge/`** (Fusión de duplicados). Covers NSS-normalized duplicate detection, the transactional merge primitive (FK/PK-collision handling across the 6 child tables, main-center recalc, dual-Moodle), field-by-field reconciliation whitelist, and the admin tool. Audit via `audit_log` (IDs in the route), no dedicated log table. |
| `docs/user-sanitization.md` | **touching `api/user-sanitization/`** (Sanitización de datos). Covers the "present-but-invalid" detection of phone/email/dni/nss reusing the existing validators (`email/phone/nss/dni .util`), the pure `detectUserIssues`/`suggestFix` helpers, server-authoritative auto-fix endpoint, unique-collision handling, and the admin tool. |
| `docs/moodle-audit.md` | **touching `api/moodle-audit/`** (Auditoría de Moodle). Covers the single-snapshot cost model (one `getAllUsers` download, everything else local), the link classification (incorrect/unverifiable/orphans/no-courses/unlinked), the shared DNI-matching util (`moodle-user-matching.util.ts`), orphan cleanup, and the admin tool (repairs via user-merge). |
| `docs/course-requests.md` | **touching `api/course-request/`** (Peticiones de centros). Covers the request header + editable student-row model (no `users`/enrollment link yet — deferred), the alias-based Excel column matching, open/closed lifecycle, endpoints, and the `/course-requests` client section (search-by-center with derived company, simple editable grid with Excel paste/upload). |
| `docs/course-catalog.md` | **touching course catalog, course creation/imports, `catalog_courses`, `course_candidates`/`course_interests`, or catalog/candidates/interests UI**. Covers catalog course → edition → group, mandatory association, automatic pending catalog entries, planning fields, candidates vs. official INAEM preinscription, the interest pool and its "incorporate to edition" flow, endpoints and migrations. |
| `docs/reports.md` | touching `api/reports/` (PDF templating, report rows). |
| `docs/backups.md` | **touching `api/backups/`** (admin panel: status/list/run/download), `.github/workflows/backup.yml`, or anything about copias de seguridad (nightly pg_dump + Storage mirror to external S3 via GitHub Actions; secrets list, restore procedure, local dev copy). |
| `docs/client.md` | frontend work under `client/` (API hooks, auth flow, routing, responsive conventions, type sharing, tests). |

Memory note `project_sage_import_field_update` tracks a pending SAGE field-sync policy decision.
