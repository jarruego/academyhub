# Ajustes de la organización

**Read before touching `api/organization/`, the settings screen, or anything that reads `organization_settings`.**

## Storage

Single row in `organization_settings` (`center_id` kept for future per-center settings, no FK):
- `settings` (JSONB) — non-secret config, validated shape (below)
- `encrypted_secrets` (JSONB) — secrets encrypted with `APP_MASTER_KEY` (AES-256-GCM objects `{ct,iv,tag}`)
- `logo_path` / `signature_path` — Supabase Storage public URLs (report/certificate assets)

## Typed model — single source of truth

`server/src/api/organization/organization-settings.model.ts`:
- `OrganizationSettingsData` — the shape: `site_name`, `contact{name,email,phone}`, `company{cif,razon_social,direccion,ciudad,responsable_nombre,responsable_dni}`, `moodle{url,customfields[]}`, `file_transfer{type,host,port,user,path}` (**no password**), `plugins{itop_training,configurable_reports,certificates,progress_bar}`.
- `normalizeOrganizationSettings(raw)` — raw JSONB → typed model with defaults; absorbs legacy forms (`moodle_url`/`moodleUrl`/`moodle_customfields` at root); never throws. **Every consumer goes through this** (moodle.service URL/customfields/itop, import.service SAGE creds, reports-pdf + user-courses-certificate company/issuer) — no ad-hoc casts of the JSONB.
- `buildIssuerLine(company)` — shared "D. …, administrador de …" line for report/certificate PDFs.
- `readOrgSecret(encrypted_secrets, key)` / `readLegacyFileTransferPassword(settings)` — secret readers (encrypted object or legacy plaintext).
- Mirror type for the client: `client/src/shared/types/organization/organization.ts` (update both when the shape changes).

Validation: `server/src/dto/organization/organization-settings.dto.ts` (nested class-validator DTOs used by `UpdateOrganizationSettingsDTO`). With the global `ValidationPipe({ whitelist: true })`, unknown keys (typos) are stripped; `company` and its 5 fiscal fields are required whenever `settings` is sent (needed by SEPE/FUNDAE reports).

## Secrets

All under `encrypted_secrets` (keys in `ORG_SECRET_KEYS`): `moodle_token`, `moodle_url` (optional override), `file_transfer_password`.
- `file_transfer.password` is **write-only**: the PATCH accepts it inside `settings.file_transfer`, the service extracts + encrypts it into `encrypted_secrets.file_transfer_password` and never persists it in the JSONB. Empty/absent = keep the stored one. Legacy rows with plaintext `settings.file_transfer.password` (or `sftp.password`) are lazily migrated on the next save; readers fall back to the legacy field until then.
- `upsertSettings` **merges** `encrypted_secrets` with the existing object (saving the Moodle token no longer clobbers the FTP password).
- GET/PATCH responses never contain secret values — only flags: `secrets: { has_moodle_token, has_file_transfer_password }`.
- Moodle token/URL resolution chain lives in `docs/mail-moodle.md`.

## Endpoints (`api/organization/`)

- `GET /api/organization/settings` — global AuthGuard (read-only). Returns the row with `settings` **normalized** (full shape, defaults applied) + `secrets` flags.
- `PATCH /api/organization/settings` — ADMIN. Body `{ settings?, encrypted_secrets? }`; `encrypted_secrets.moodle_token_plain`/`moodle_url_plain` are encrypted server-side.
- `POST /api/organization/upload` — ADMIN. Multipart `file` + `type` (`logo`|`signature`) → Supabase Storage, deletes the previous asset.

## Client UI

`client/src/routes/organization/OrganizationSettingsPage.tsx` (`/organization`, admin-editable, others read-only): RHF + Zod sectioned form (replaced the old raw-JSON textarea) — General, Datos fiscales (CIF/DNI validated with `schemas/cif.schema`/`dni.schema`), Moodle (URL + customfields `useFieldArray` + token modal + connection check), Importación SAGE (password `Input.Password` write-only, placeholder shows whether one is stored), Plugins (switches), Logo y firma (uploads). Hooks under `hooks/api/organization/`.
