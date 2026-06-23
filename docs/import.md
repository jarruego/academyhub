# Import flows

**Read before touching anything under `api/import-sage/`.**

> The INAEM import (`api/import-inaem/`) is a separate flow documented in `docs/import-inaem.md`.

## SAGE (`api/import-sage/`) — active import path
Semicolon-delimited CSV (uploaded manually or via FTP/SFTP); **may arrive unordered**. Each run creates an `import_job`; rows processed sequentially. The job is created **before** the FTP download/extraction (`startImportJobFromFtp` → `createSageJob`), so pre-processing failures (FTP down, missing/corrupt file, archive without CSV) are recorded as `FAILED` jobs (with `error_message`) in the history instead of being lost as a bare 500. Key CSV fields: `[1]` center code, `[2]` center name, `[3]` employee code, `[4]` DNI, `[5]` name, `[6]` surnames, `[7]` start_date, `[8]` end_date, `[10]` email, `[14]` NSS, `[17]` company name, `[18]` company CIF.

### FTP/SFTP source config
The importer reads transfer credentials from `settings.file_transfer` (`{ type: 'ftp'|'sftp', host, port, user, password, path }`) via `getFileTransferConfig` (DB first, then `SFTP_SAGE_*` env vars). It does **not** read the legacy `settings.sftp` key. The downloaded file may be a CSV or a `.zip`/`.7z` archive containing the CSV.

### Match order per row
DNI exact → NSS conflict → name similarity ≥0.9 (Levenshtein) → create new user. `findSimilarUsers` runs against the preloaded `usersByIdCache` (no per-row DB query); names are normalized once during preload (`__simName`/`__simLen`) and a length-difference pre-filter skips Levenshtein for candidates that provably can't reach the threshold (same results, fewer computations — keep both invariants if changing it). When a match is ambiguous, creates an `import_decision` for manual review; **center assignment is skipped until the decision is resolved**. A DNI-matched row whose NSS already belongs to a *different* user (typical NIE→DNI duplicate identity) also creates an `import_decision`: resolving as link/update_and_link routes the row to the NSS owner; skip applies it to the DNI-matched user without the NSS (see `handleNssConflictOnMatchedUser`).

### Decisions screen scope (SAGE vs INAEM)
`import_decisions` is shared by SAGE and INAEM, distinguished by `import_source` (`sage` vs `inaem-alumnos`/`inaem-preinscripciones`). They are **not interchangeable**: SAGE decisions are match-ambiguity decisions resolved via `link`/`create_new`/`update_and_link`/`skip` (`processDecision` → company/center processing); INAEM decisions are field-value conflicts resolved as overwrite/keep in the INAEM tool's "Conflictos" tab (`docs/import-inaem.md`) — they have no company/center, so the SAGE link flow throws "Datos de empresa incompletos". Therefore `getPendingDecisions()` with **no source** filter excludes `inaem%` rows (the SAGE "Decisiones Pendientes" screen passes no source), and `processDecision` rejects `inaem%` decisions defensively.

Cuando el conflicto NSS revela que son **dos fichas de la misma persona** (NIE↔DNI), `update_and_link` choca con el `UNIQUE` de `dni`/`nss` (el servicio lo detecta y avisa antes de lanzar el 23505 opaco). La vía para resolverlo es la herramienta **Fusión de duplicados** (`docs/user-merge.md`), no la decisión de importación.

### `buildUserUpdates` policy
fill-gaps-only — only fills fields that are empty in DB, never overwrites. `name`/`first_surname`/`second_surname`/`dni` are never updated for existing users. **NSS** que se escribe (aquí y en `createNewUser`) se guarda en forma canónica de 12 dígitos vía `canonicalNss` (`src/utils/nss.util.ts`) — rellena el cero a la izquierda que SAGE/Excel suele perder; ver `docs/user-merge.md`. Exception: `gender` (CSV `Sexo`: 1=Male, 2=Female) treats `'Other'` (the column default) as "unknown" and fills it. Emails failing a basic format check are discarded (treated as absent). `SageImportOptions` (`overwriteGender`, `overwriteSalaryGroup`, `overwriteBirthDate`, `overwriteEducationLevel` — shared checkbox component `ImportOverwriteOptionsForm` in both the manual upload and FTP import screens; sent as form fields in the multipart endpoint, hence the `@Transform` string→boolean in the DTOs) forces the CSV value over any existing one for that field only; a row lacking a usable CSV value never clears the DB value.

### `education_level`
filled from CSV `Código nivel` (SEPE code table) or free-text `Nivel Estudios` via keyword rules, mapped to FUNDAE codes 1-10 — see `import-sage/education-level.util.ts` (+ spec). When unclassifiable, the import fills empty values with `'10'` (Otras titulaciones, `FUNDAE_DEFAULT_EDUCATION_LEVEL`); the default never overwrites an existing value, even with `overwriteEducationLevel` checked. (May change in future to always sync some fields from SAGE — see memory `project_sage_import_field_update`.)

### `user_center`
one record per user+center pair (no history). `is_main_center` is recalculated by `ensureMainCenter()` after each row: if current main is still active (`end_date IS NULL`) it is never overwritten (protects manual assignments); otherwise among active records the **oldest** `start_date` wins; if all closed, highest `end_date`. During an import, `user_center` is read from an in-memory write-through cache (`userCenterCache`, null outside imports — DB fallback); any new code writing `user_center` mid-import must update it. `ImportModule.onModuleInit()` cleans up jobs stuck in `PROCESSING` on startup.

### Failed rows
Saved to `failed_user_imports` (schema-defined + versioned in migration `0043`; the per-row runtime `CREATE TABLE` was removed — defensive `CREATE TABLE IF NOT EXISTS` remain only in `getFailedUsers`/`getFailedUsersStats`/`deleteAllFailedUsers`). Surfaced in the client "Usuarios Fallidos" tab (`FailedUsersView`). `DELETE /api/import/failed-users` (`deleteAllFailedUsers`, **ADMIN-only**) wipes them — "Borrar todos" button with `Popconfirm`.

**SAGE/INAEM separation**: `failed_user_imports` and `import_decisions` are shared tables, but every SAGE view filters out INAEM rows (`import_source = 'inaem'` for failed users, `'inaem-*'` for decisions). So `getFailedUsers`/`getFailedUsersStats`/`deleteAllFailedUsers` and `getPendingDecisions`/`getProcessedDecisions` all scope to `import_source IS DISTINCT FROM 'inaem'` / `NOT LIKE 'inaem%'`; `deleteAllFailedUsers` uses a scoped `DELETE` (not `TRUNCATE`) so INAEM failures survive. INAEM conflicts/failures are managed in the INAEM tool (`docs/import-inaem.md`).

### Performance notes (the loop)
`processCSVBackground` processes rows sequentially in batches; it yields the event loop via the awaited DB calls (progress/cancel/writes) — the old artificial `setTimeout` pauses were removed. There are **no per-row transactions** (a row creating user+user_center is not atomic); a deliberate decision, since partial state = a user without a center link (recoverable next import) and `failed_user_imports` preserves the data. Do not add per-row transactions naively: the write-through caches (`companiesCache`/`centersCache`/`usersCache`/`userCenterCache`) are updated mid-row, so a rollback would desync them.

### Testing
Unit tests cover the pure matching logic: `buildUserUpdates` and `findSimilarUsers` (`import.service.spec.ts`, seeding `usersByIdCache` to avoid DB), plus `education-level.util.spec.ts`. **PENDING (deferred):** a full E2E (login → upload CSV → poll job → resolve a decision). It needs a real test Postgres with `unaccent`+`pg_trgm` (e.g. Docker/Testcontainers) and is brittle; deferred until there is a staging/test environment, since the core matching is already unit-covered. Don't add it without that infra.
