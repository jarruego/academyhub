<p align="center">
  <img src="client/public/logo.png" alt="AcademyHub Logo" width="200"/>
</p>

# 📚 AcademyHub

**Open-source web platform for training management in SMEs integrating Moodle.**

AcademyHub streamlines training management for small and medium-sized enterprises (SMEs) that use Moodle as their learning management system. It centralizes the administration of courses, users, groups, companies and centers, automates data imports from common Spanish business systems, and generates the regulatory compliance reports (SEPE / FUNDAE / INAEM) that training providers need — all without requiring advanced Moodle administration skills.

Built with a modern, scalable architecture and released under the MIT license for free use, redistribution and customization.

## 🎓 Academic Origin

This project originated as a Final Degree Project (Trabajo de Fin de Grado) and has evolved into an active open-source platform. The original academic repository can be found at [jarruego/TFG](https://github.com/jarruego/TFG) (archived).

## ✨ Key Features

- **Course, group, user, company & center management** — full CRUD with a 3-axis course typology (`modality` · `origin` · `funding`) and a unified active/inactive state model derived from group dates and manual overrides.
- **Deep Moodle integration** — two-way sync of courses, groups, enrolled users and activity completion; resolves the Moodle token/URL through a layered chain (per-user → organization → env fallback).
- **Data cross-reference tool** — matches local users against Moodle accounts (by DNI, email and name similarity) to detect and reconcile discrepancies.
- **Bulk import pipelines:**
  - **SAGE** — automated CSV import from an SFTP server (manual upload or scheduled cron), with fill-gaps matching and conflict decisions.
  - **INAEM** — import of acciones / alumnos / preinscripciones from official INAEM files, with auto-creation of provisional public-funded courses.
- **Forum duplicator** — replicates a model forum discussion to every group at once, authored by each group's tutor, preserving inline images/embeds and idempotent by subject.
- **Mail system** — SMTP sending with reusable HTML templates (images hosted on Supabase Storage), variable substitution (e.g. Moodle credentials), and a rich `email_log`.
- **Regulatory reports** — server-side PDF generation from templates for SEPE / FUNDAE / INAEM compliance, including optional student dedication time from a Moodle plugin.
- **Security & auditing** — JWT auth with role-based access (`admin` / `manager` / `viewer`), token revocation, request rate-limiting, secrets encrypted at rest (AES-256-GCM), and an HTTP-level audit log of every mutating request.
- **Internal scheduler** — optional `node-cron` tasks for automated SAGE imports and daily Moodle progress sync.

## 🗂️ Project Structure

```
academyhub/
├── client/   # React + Vite frontend
├── server/   # NestJS + Drizzle ORM backend
└── docs/     # Per-subsystem documentation (see map below)
```

## 🛠️ Tech Stack

- 💻 **Frontend:** React 19, TypeScript, Vite 6
- ⚙️ **Backend:** NestJS 10, TypeScript, Drizzle ORM
- 🗄️ **Database:** PostgreSQL 16 (extensions: `unaccent`, `pg_trgm`)
- 🐳 **Docker:** PostgreSQL service for local development

### Main Production Libraries

- **Frontend:** [Ant Design](https://ant.design/) (UI), [TanStack React Query](https://tanstack.com/query/latest) (data fetching/caching), [React Router](https://reactrouter.com/) (routing), [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) (forms & validation), [Axios](https://axios-http.com/) (HTTP), [Day.js](https://day.js.org/) (dates), [xlsx](https://github.com/SheetJS/sheetjs) (spreadsheet import/export).
- **Backend:** [NestJS](https://nestjs.com/) (framework), [Drizzle ORM](https://orm.drizzle.team/) (ORM), [Passport](http://www.passportjs.org/) (auth), [class-validator](https://github.com/typestack/class-validator) (DTO validation), [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction) (API docs), [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting) (rate limiting), [node-cron](https://github.com/node-cron/node-cron) (scheduler), [pg](https://node-postgres.com/) (PostgreSQL driver), [xmlbuilder2](https://oozcitak.github.io/xmlbuilder2/) (XML).

## 🔗 Moodle Integration

AcademyHub talks to Moodle over the official REST Web Services API. The functions used, by area:

| Area | Web Service functions |
|---|---|
| **Courses** | `core_course_get_courses` |
| **Users** | `core_user_get_users`, `core_user_get_users_by_field`, `core_user_get_course_user_profiles`, `core_user_create_users`, `core_user_update_users` |
| **Enrolment** | `core_enrol_get_enrolled_users` |
| **Groups** | `core_group_get_course_groups`, `core_group_get_groups`, `core_group_get_group_members`, `core_group_create_groups`, `core_group_update_groups`, `core_group_delete_groups`, `core_group_add_group_members` |
| **Completion** | `core_completion_get_activities_completion_status` |
| **Forums** | `mod_forum_get_forums_by_courses`, `mod_forum_get_forum_discussions`, `mod_forum_get_discussion_posts`, `mod_forum_add_discussion` |
| **Site** | `core_webservice_get_site_info` |

### Optional Custom Moodle Plugins

Some deployments use a custom Moodle plugin (`itop_training`). When enabled, AcademyHub fetches student dedication time and shows the **Tiempo usado** column in reports and PDFs.

- **Custom WS function:** `block_advanced_reports_get_userstats` (stat: `platformdedicationtime`)
- **Config flag:** `organization_settings.settings.plugins.itop_training = true`

If the flag is **false** or missing, the platform skips the custom call and hides time-spent data. A separate optional helper, `block_gestion_grupos_create_group_custom`, is used when present for custom group creation.

### Optional Custom User Profile Field

For more accurate user matching, AcademyHub can use a custom **`DNI`** (Spanish National Identity Document) text field on the Moodle user profile. It is entirely optional — the cross-reference tool also matches by email and name similarity — but when present it provides precise student identification, useful for SEPE/FUNDAE compliance tracking.

## 🚀 Installation and Usage

### Prerequisites

- Node.js v18 or higher
- PostgreSQL 16 (or Docker)

### Clone the repository

```bash
git clone https://github.com/jarruego/academyhub.git
cd academyhub
```

### Database (PostgreSQL via Docker)

A `docker-compose.yml` at the repo root provisions a PostgreSQL 16 instance for local development:

```bash
docker-compose up -d
```

> The compose file only runs the database. The client and server run directly via npm (see below).

Before the first run, the required extensions must exist. AcademyHub uses `unaccent` to make user searches tolerant to diacritics (e.g. `CARREÑO` vs `CARRENO`) and optionally `pg_trgm` for faster `LIKE '%term%'` searches:

```bash
psql "postgresql://USER:PW@HOST:PORT/DATABASE" -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
psql "postgresql://USER:PW@HOST:PORT/DATABASE" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

> Creating extensions requires sufficient privileges (usually superuser). A migration also attempts to create `unaccent` on new databases, so the account running migrations must have permission to create extensions.

### Server

```bash
cd server
npm install
cp .env.example .env      # then fill in the values (see below)
npm run db:migrate        # apply database migrations
npm run start:dev         # NestJS watch mode
```

### Client

```bash
cd client
npm install
npm run dev               # Vite dev server, proxies /api → localhost:3000
```

## 🔑 Environment Variables

Server variables live in `server/.env` (start from `server/.env.example`).

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | JWT signing secret |
| `MOODLE_URL` | Moodle REST Web Service base URL |
| `APP_MASTER_KEY` | Base64 AES-256 key for encrypting secrets at rest. Generate with `openssl rand -base64 32` |

### Optional (selected)

| Variable | Default | Description |
|---|---|---|
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `PORT` | `3000` | HTTP port |
| `MOODLE_TOKEN` | — | Legacy fallback Moodle token (usually stored encrypted in the DB instead) |
| `DB_SSL` / `DB_POOL_MAX` | `false` / `10` | SSL toggle (auto-on in prod) and PG pool size |
| `ENABLE_CRON_SCHEDULER` | `false` | Master switch for the internal scheduler |
| `SAGE_IMPORT_ENABLED` / `SAGE_IMPORT_CRON` | `true` / `0 2 * * *` | Automated SAGE import schedule |
| `MOODLE_ACTIVE_SYNC_ENABLED` / `MOODLE_ACTIVE_SYNC_CRON` | `false` / `0 4 * * *` | Daily Moodle progress sync |
| `SCHEDULER_TIMEZONE` | `UTC` | Cron timezone |
| `SFTP_SAGE_*` | — | SFTP credentials/path for the SAGE import |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | — | Supabase Storage for mail-template images |

> Swagger API docs are served at `/documentation` when `NODE_ENV !== 'production'`.

## 🌱 Seed Data Scripts

Two scripts can populate the database with sample data (run from `server/`):

```bash
npx ts-node seed-all.ts         # All main tables (users, companies, centers, courses, groups, relationships)
npx ts-node seed-auth-users.ts  # Only authentication users, for quick login/role testing
```

> **Note:** these scripts erase existing data in the affected tables before inserting samples.

## 📖 Documentation

Deep, per-subsystem documentation lives in [`docs/`](docs/):

| Doc | Covers |
|---|---|
| [`architecture.md`](docs/architecture.md) | Module wiring, the three user concepts, course typology, active-state model, repositories, migrations, scheduler |
| [`security.md`](docs/security.md) | Guards, roles, JWT lifecycle, password hashing, secrets at rest, audit log |
| [`import.md`](docs/import.md) | SAGE import: matching, decisions, SFTP config, failed imports |
| [`import-inaem.md`](docs/import-inaem.md) | INAEM import: acciones / alumnos / preinscripciones, provisional courses |
| [`mail-moodle.md`](docs/mail-moodle.md) | Moodle integration internals, token/URL resolution, mail system & `email_log` |
| [`forum-duplicator.md`](docs/forum-duplicator.md) | Forum duplicator tool |
| [`reports.md`](docs/reports.md) | PDF templating and report rows |
| [`client.md`](docs/client.md) | Frontend: API hooks, auth flow, routing, responsive conventions, tests |

## 🤝 Contributing

🎉 **Contributions are welcome!**

- 🐛 **Bug reports** & 💡 **feature requests:** [open an issue](https://github.com/jarruego/academyhub/issues)
- 🔧 **Code:** fork → feature branch → make & test changes → open a pull request
- 📖 **Docs** & 🌍 **translations** are equally appreciated

### Development Guidelines

- Follow existing code style and conventions
- Write clear commit messages and add tests for new logic
- Type-check both sides and update relevant documentation
- Ensure your changes don't break existing functionality

## 🗺️ Roadmap

- **Current focus:** enhanced Moodle integration, UX improvements, performance, extended SEPE/FUNDAE compliance.
- **Future:** multi-language support, advanced reporting & analytics, mobile app, integration with other LMS platforms.

## 💬 Community and Support

- **Discussions:** [GitHub Discussions](https://github.com/jarruego/academyhub/discussions)
- **Issues:** [Report bugs or request features](https://github.com/jarruego/academyhub/issues)

## 📄 License

Licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Made with ❤️ for the training industry</strong><br>
  <em>Empowering SMEs with better training management</em>
</p>
