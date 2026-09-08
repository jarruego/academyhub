# INAEM import

**Read before touching anything under `api/import-inaem/`.**

Imports the periodic INAEM exports (Aragón training programme for unemployed people): course catalogue, enrolled students, and pre-registrations. Students are "free" learners with no employer company.

## Source files (3, all optional per run)
Joined by the **file number / nº de expediente** (`N.Expediente`, e.g. `25/0202.001`):
- **Acciones** — real `.xlsx`. Course catalogue. Cols: `Estado` (1st column, **no header** → parser names it `COL_1`), `N.Exp.`, `Curso`, `Mes-Año`, `Inicio`, `Fin`, `Horas`, `Alum.`, `Gestor`. Only file carrying the course **name**.
- **Alumnos** — `.xls` that is actually an **HTML table** (latin-1, `<tr>` not closed). Enrolled students. Includes `FINALIZADO` (SI/NO).
- **Preinscripciones** — same HTML format. Applications. Includes `Prioritaria` (+ ignored `Revisada`, `Correo no seleccionado`).

Relationship: Alumnos ⊆ Preinscripciones (an enrolled student is an admitted applicant); a person (DNI) may appear in several expedientes.

## Data model
All people live in `users` (no parallel person table). Schema added (migrations `0049`, `0050`):
- Every imported/provisional `courses` row also has a mandatory `id_catalog_course`. New actions reuse a normalized catalog name or create a `catalog_courses` row in `PENDIENTE_REVISION`; the import never leaves an orphan edition. Full rules → `docs/course-catalog.md`.
- `courses.file_number` — nº de expediente, **UNIQUE** (NULLs don't collide; matching key + manual tagging). `courses.is_provisional` (autocreated stub, completed later). INAEM courses are tagged `client=INAEM` + `funding=PUBLICA` (typology model → `docs/architecture.md`).
- `user_group.finalized` (bool) ← `FINALIZADO`.
- `user_preinscription` (junction like `user_course`, PK `id_user`+`id_course`): `status` enum `preinscription_status` (`PREINSCRITO`/`MATRICULADO`/`DESCARTADO`/`BAJA`), `prioritaria`, `preinscription_date`, `registration_source` (`IMPORTACION_INAEM`/`CONFIRMACION_MANUAL`), `registered_at`, `verified_at`, `verified_by`. Repo: `database/repository/preinscription/user-preinscription.repository.ts`. Es la constancia **oficial** INAEM; el import crea siempre además una fila en `course_candidates` (gestión operativa interna) → ver "Candidatos vs. preinscripción oficial INAEM" en `docs/course-catalog.md`.

## Parser (`inaem-*.parser.ts`)
- `parseInaemHtmlTable` (dep-free): decodes UTF-8-strict→latin-1 fallback, splits rows on `<tr>` open (unclosed tags), decodes entities. Returns `ParsedTable { headers, rows: Record<string,string>[] }`; blank headers → `COL_<n>`.
- `parseInaemXlsx` (exceljs): first sheet; dates → ISO `yyyy-mm-dd` UTC.
- `parseInaemFile` auto-detects: ZIP magic `PK` → xlsx, else HTML.
Mapping/normalization is **not** in the parser (it returns raw rows); see below.

## Mapping & normalization
- `inaem-normalize.util.ts`: `sanitizeDni` (uppercase, strip non-alphanumerics), `inferDocumentType` (X/Y/Z→NIE), `parseInaemDate` (dd/mm/yyyy + ISO), `parseGender` (Hombre/Mujer), `parseSiNo`, `cleanText`, `buildInaemObservationBlock` + `upsertObservationBlock` (idempotent block per expediente, header `[INAEM <exp>]`).
- `inaem-column-map.ts`: exact column header constants + `OBSERVATION_FIELD_HEADERS`.
- `inaem-mapping.util.ts`: `mapRowToUserFields`, `buildObservationsForRow`, `computeUserMerge` (fill-gaps update + conflict list). Email y teléfono se sanean con los mismos utils compartidos que SAGE: `sanitizeEmail` (`src/utils/email.util.ts`) y `sanitizePhone` (`src/utils/phone.util.ts`) — el teléfono prueba móvil y, si queda inválido (<9 dígitos), cae al fijo.
- `inaem-education-level.util.ts`: `mapInaemEducationLevel` — explicit INAEM→FUNDAE dict (FP I=3, "FP II/Ciclo Grado medio"=4, Ciclo Grado Superior=6, Diplomatura=7, Licenciatura=8, ESO/Graduado Escolar=3, Estudios primarios=2, Sin estudios=1), fallback to SAGE keyword classifier, then default `10`; empty → undefined.

## Import flow (`inaem-import.service.ts`, `InaemImportService`)
Background job (reuses SAGE `JobService` exported by `ImportModule`; `import_type='inaem'`). Order: **Acciones → Preinscripciones → Alumnos** (Preinscripciones crea la preinscripción con `prioritaria`; Alumnos la promueve a `MATRICULADO` al matricular). Preloads users (by sanitized DNI) and courses (by `file_number`).
- **Course matching**: `file_number` exact → else create. New/provisional courses get `client=INAEM` + `funding=PUBLICA`. Existing matched course: fill-gaps for dates/hours/client/funding (never overwrites a manual value); a provisional course gets its real name + `is_provisional=false` when Acciones arrives. Course dates come from `Inicio`/`Fin` (not `Mes-Año`); when dates are filled on a course they propagate to its groups that have empty dates. **Acciones garantiza grupo** también para un curso ya existente (idempotente, vía `ensureGroup`): recrea el grupo si se borró a mano.
- **ensureCourse** (Alumnos/Preinscripciones): if expediente has no course and `createMissingCourses` (default on) → create **provisional** course + group; else the row fails to `failed_user_imports`.
- **User upsert** by sanitized DNI; **no DNI → row skipped** to `failed_user_imports`. Fill-gaps (`computeUserMerge`); conflicts (DB has a different non-empty value) are recorded in `import_decisions` (`import_source` `inaem-alumnos`/`inaem-preinscripciones`) and **not** overwritten. **NSS is not imported** from INAEM. Observations get the expediente block (idempotent).
- **Enrollment** (Alumnos): matrícula **a nivel de curso y de grupo**. Si el alumno ya está en algún grupo del curso (p.ej. matriculado a mano) → se respeta ese grupo (no se le mueve ni duplica), se fija `finalized`, se garantiza el `user_course`, y en **fill-gaps** se rellena `user_group.id_role` con `student` si estaba vacío (sin pisar tutores u otros roles explícitos). Los campos del usuario y las observaciones se rellenan (fill-gaps) en `upsertUser`, que corre para todos los alumnos antes de la matriculación. Si no está en ningún grupo → matrícula canónica vía `GroupService.addUserToGroup` (`allowWithoutCenter: true`), que crea `user_course` + `user_group` con rol `student`, y luego se fija `finalized` en ese grupo. `FINALIZADO` (SI/NO) del INAEM **manda** (sobreescribe). Finalmente marca la `user_preinscription` como `MATRICULADO`.
- **Preinscription** (Preinscripciones): upsert `user_preinscription` (`prioritaria`); status defaults `PREINSCRITO` and is **not** downgraded on conflict (protects an already-`MATRICULADO` row on a Preinscripciones-only re-import).
- **Vinculación con intereses (fase 3)**: `linkOpenInterest` — si la candidatura recién creada/actualizada no tiene `id_interest`, busca un interés abierto (`INTERESADO`/`CONTACTADO`) de la misma persona para el curso de catálogo de la edición, lo enlaza y avanza su estado (`CONVOCADO` al importar Preinscripciones, `MATRICULADO` al importar Alumnos), igual que "Incorporar a edición". Nunca retrocede el estado ni revierte uno ya `DESCARTADO`. Detalle → `docs/course-catalog.md`.
- Observations fields dumped (only if present): SITUACIÓN ACTIVO, EMPRESA, CIF/DOMICILIO/CP/LOCALIDAD/PROVINCIA EMPRESA, N.EMPLEADOS, PYME, SECTOR CONVENIO, AREA FUNCIONAL, CATEGORIA, DISPONIBILIDAD HORARIA, HORARIO. **Excluded**: Revisada, Correo no seleccionado, NSS. `Prioritaria` → column.

## Endpoints (`api/import-inaem`)
No class-level guard — every handler carries its own `RoleGuard(...)` (previously a single class-level `RoleGuard([ADMIN, MANAGER])` covered them all; split so `upload`/`job-status` could allow more than ADMIN/MANAGER without loosening anything else, see below).
- `POST /upload` (`RoleGuard([ADMIN, MANAGER, VIEWER, TUTOR])`) — `FileFieldsInterceptor` fields `acciones`/`alumnos`/`preinscripciones` (all optional) + `createMissingCourses` + `id_course` → `{ jobId }`. All other endpoints below stay `RoleGuard([ADMIN, MANAGER])` (or stricter) as before.
  - **Permiso puntual `can_manage_candidates`** (`auth_users.can_manage_candidates`, independiente del rol — pestaña "Permisos" al editar un usuario, `docs/security.md`; también da edición completa de las pestañas Planificación y selección + Candidatos, ver `docs/course-catalog.md`): el guard del endpoint deja pasar a cualquier rol autenticado, pero `InaemImportController.upload` comprueba dentro del handler (no en un guard: el interceptor que rellena los ficheros corre después de los guards) si el actor es ADMIN/MANAGER (acceso completo, igual que siempre) o si necesita el flag:
    - Sin ADMIN/MANAGER y sin el flag → `ForbiddenException`.
    - Con el flag pero sin ADMIN/MANAGER: **nunca** puede enviar `acciones`/`alumnos` (`ForbiddenException` si los incluye); `id_course` es obligatorio; el servicio resuelve su `file_number` (`InaemImportService.getCourseFileNumber`) y se pasa como `InaemImportOptions.restrictToFileNumber` — `importPreinscripciones` descarta (a `failed_user_imports`) cualquier fila cuyo expediente no coincida exactamente, sin tocar ningún otro curso; `createMissingCourses` se fuerza `false` sea cual sea el body.
    - ADMIN/MANAGER siguen sin restricción (pueden tocar cualquier expediente del fichero, exactamente igual que antes).
  - **Validación real de formato**: antes de procesar ninguna fila, si viene `preinscripciones` se comprueba que sus cabeceras incluyen `N.Expediente` y `NIF/NIE` (`COMMON.FILE_NUMBER`/`COMMON.DNI`) — si faltan, el job falla entero con un mensaje claro en vez de que cada fila falle en silencio una a una (comportamiento antiguo, seguía dando `0 preinscripciones` sin pista del motivo).
- `GET /job-status/:jobId` (`RoleGuard([ADMIN, MANAGER, VIEWER, TUTOR])` — mismo motivo que `upload`: quien lanza el import vía el permiso puntual también necesita consultar su progreso).
- `GET /preinscriptions/by-user/:id`, `GET /preinscriptions/by-course/:id`.
- `GET /preinscriptions/by-course/:id/enrolled-count` → `{ count }` (matriculados en algún grupo del curso).
- `DELETE /preinscriptions/by-course/:id` (**solo ADMIN**, guard de método extra) → `{ deleted }`; lanza `ConflictException` si el curso tiene matriculados (`countEnrolledByCourse > 0`).
- `GET /conflicts`, `PUT /conflicts/:id/resolve` (`{ action: 'overwrite' | 'keep' }`).
- `DELETE /conflicts/:id` (descarta un conflicto pendiente sin tocar el usuario), `DELETE /conflicts` (borra todos los pendientes `inaem-*`, devuelve `{ deleted }`). Borrar solo afecta a filas `processed=false`; un conflicto borrado puede reaparecer si se reimporta el mismo dato divergente (el importador no consulta decisiones pasadas).

## Client surfaces
The typology UI (Cliente/Financiación fields, courses-list tabs/columns, and the type-driven group-table columns including **Finalizado**) is **general** and documented in `docs/client.md` (Course typology / `getCourseProfile`). INAEM-specific bits only:
- Course form (create + detail, `routes/courses/`): **Nº Expediente** field + "Provisional" badge; server returns a friendly `ConflictException` on duplicate `file_number` (shown in the form). Courses list shows the **Nº Exp.** column and search matches `file_number`.
- Course detail: la antigua pestaña **Preinscripciones** (`course-preinscriptions-section.tsx`, eliminada) se sustituyó por **Candidatos** (`course-candidates-section.tsx`, ver `docs/course-catalog.md`), que muestra los preinscritos oficiales junto al resto de candidatos internos. Los endpoints `GET/DELETE /preinscriptions/by-course/:id` y `.../enrolled-count` siguen existiendo en el backend (uso administrativo/API) pero ya no tienen consumidor en el cliente.
  - Botón **"Importar Preinscritos INAEM"** en esa pestaña (visible para ADMIN/MANAGER, o cualquiera con `can_manage_candidates`): reconversión del antiguo "Importar Excel" (que solo emparejaba por DNI contra usuarios existentes y creaba `course_candidates`, sin tocar `user_preinscription`). Ahora sube el fichero **oficial** de Preinscripciones al mismo `POST /api/import-inaem/upload` que la herramienta general — mismo flujo real, con el reparto de permisos descrito arriba. Flujo en el cliente (`ImportInaemPreinscripcionesModal.tsx`): 1) aviso explícito de lo que va a pasar + selección del fichero, 2) reautenticación por contraseña (`ConfirmPasswordModal.tsx` + `POST /auth/verify-password`, nuevo endpoint — ver `docs/security.md`), 3) subida y sondeo de progreso (reutiliza `useInaemImportUpload`/`useInaemJobStatus`, los mismos hooks que `/tools/import-inaem`).
- The **Finalizado** data shown in the group table and the user's Preinscripciones tab comes from `user_group.finalized`, populated by this import (`findUsersInGroup` returns it). Display rules → `docs/client.md`.
- Tool **Importación INAEM** (`/tools/import-inaem`, admin): 3-file upload + `createMissingCourses` + progress/summary; **Conflictos** tab (resolve overwrite/keep, **borrar** por fila o **Borrar todos** con `Popconfirm`). Hooks in `hooks/api/import-inaem/`.
- User detail: **Preinscripciones** tab (admin/manager only; `user-preinscriptions-section.tsx`). Junto al estado `MATRICULADO` muestra un tag **Finalizado** (verde) / **No finalizado** (rojo) según `finalized` de la matrícula; si no hay datos (`finalized` null) no muestra tag. El backend (`findByUser`) calcula `finalized` con `bool_or(user_group.finalized)` por curso (null si no hay matrícula).

## Gotchas / conventions
- Las preinscripciones (y las candidaturas, `course_candidates`) **bloquean el borrado del curso** (nunca se arrastran en cascada): hay que borrarlas antes desde la pestaña Candidatos. Ver "Course deletion" en `docs/architecture.md` y candidatos/preinscripciones en `docs/course-catalog.md`.
- `course.file_number` is UNIQUE — the course service trims it and turns `''`→`null` (so untagged courses don't collide) and maps Postgres `23505` to a `ConflictException`.
- The importer has **no per-row transactions** (mirrors SAGE); failed rows are preserved in `failed_user_imports` (`import_source='inaem'`).
- Tests cover pure logic (parser, normalize, education-level, mapping). No automated E2E (needs real Postgres with `unaccent`/`pg_trgm`, like SAGE — don't add without that infra).

## Deferred (not implemented)
- Decision UI to link an expediente to an existing manual course by name/date similarity (rely on manual `file_number` tagging + provisional autocreate).
- `Estado`/`Gestor` from Acciones are not persisted (no columns).
- If a course has several groups, enrollment uses the first (no group-picker decision).
- `professional_category` is **not** mapped from `CATEGORIA` (kept in observations, by decision); `contribution_group_code`/grupo de cotización is not derivable from INAEM data.
- Client: `finalized` badge in the user's courses table; "only pre-registered" filter in the paginated users list.
