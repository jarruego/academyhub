# Auditoría de vínculos con Moodle

**Read before touching `api/moodle-audit/`.**

Herramienta admin que cruza **todos los usuarios de Moodle** con la BD local para detectar vínculos `moodle_users` incorrectos (los duplicados que creaban los imports antiguos con matching de DNI exacto), vínculos huérfanos, cuentas sin vincular y usuarios de Moodle sin ningún curso (candidatos a borrado) — gastando el mínimo de llamadas a Moodle (cuota limitada).

## Modelo de coste (descargas explícitas, todo lo demás local)
Dos snapshots en memoria del proceso, cada uno con su botón y su `fetchedAt`:
- **Usuarios**: `refreshSnapshot()` → `MoodleService.getAllUsers()` (`1 + ceil(N/200)` llamadas; medidas con `moodleCallCount`, en la UI `moodleCallsLastFetch`). La proyección `AuditMoodleUser` conserva `suspended`, `firstaccess` y `lastaccess` (epoch s; 0 = nunca conectado).
- **Matrículas**: `refreshEnrolments()` → `getAllCourses()` (1) + `getEnrolledUserIds(courseId)` por curso (`core_enrol_get_enrolled_users` con `userfields=id`, payload mínimo). Salta el curso 1 (portada del sitio) y **falla cerrado**: si un curso no se puede leer se descarta el snapshot entero (sus matriculados saldrían como falsos candidatos a borrado).

El informe (`getReport`) y las reparaciones trabajan solo contra la BD local (0 llamadas). Ambos snapshots se **persisten en `moodle_audit_snapshot`** (una fila JSONB por `kind`: `users` | `enrolments`, migración 0056) y se restauran con carga perezosa (`ensureLoaded`) — sobreviven a reinicios sin gastar llamadas. El borrado de usuarios reescribe el payload persistido para mantenerlo coherente.

## Estado persistido en la BD (`moodle_users.suspended` / `deleted_in_moodle_at`)
Dos columnas espejo del estado en Moodle (migración 0055). `POST sync-status` (0 llamadas) las escribe desde el snapshot: copia `suspended` de las cuentas vivas y marca `deleted_in_moodle_at = now()` en los vínculos cuyo `moodle_id` no está en el snapshot. La fila se **conserva como lápida** (histórico: `user_course.id_moodle_user` sigue apuntando a ella); la limpieza física de huérfanos sigue disponible aparte. Los huérfanos ya marcados salen con `marked_deleted` en el informe (tag «lápida marcada» en la UI).

## Clasificación (`moodle-audit.util.ts`, pura, con tests)
`classifyMoodleLinks` cruza snapshot ↔ `moodle_users` por `moodle_id` y verifica por DNI usando `moodleUserDniKeys` (mismo origen que el matching del import: customfield `dni` → `username` si valida, ver abajo) contra `users.dni` normalizado (compacto-mayúsculas):
- **incorrectLinks**: vinculado al usuario local A pero el DNI casa con B → A es el duplicado probable; `nameMatch` compara los nombres normalizados de A y B.
- **unverifiable**: vinculado pero sin verificación posible (`no-dni` | `dni-not-found`).
- **orphans**: filas de `moodle_users` cuyo `moodle_id` no está en el snapshot (cuenta borrada en Moodle; `getAllUsers` filtra `deleted=0`, así que un *suspendido* NO es huérfano). Con contadores: `user_course_refs`, `token_links`, `other_accounts`.
- **noCourses**: vinculado y su usuario local tiene 0 filas en `user_course` (solo BD local: no consulta matrículas de Moodle, costaría llamadas).
- **unlinked**: cuentas de Moodle sin fila en `moodle_users`, con `wouldMatchUser` (a quién vincularía el próximo import).
- **usernameMismatches** (dimensión independiente, puede solaparse con las demás): el `moodle_username` guardado no coincide (comparación exacta) con el real del snapshot.
- **cleanupCandidates** (`classifyCleanupCandidates`, requiere el snapshot de matrículas): usuarios de Moodle no matriculados en NINGÚN curso de Moodle. Cada candidato lleva `never_accessed` (`firstaccess === 0`) y `protected`/`protected_reasons`: `auth-user` (su email/username de Moodle coincide, case-insensitive, con un `auth_users` de la app), `tutor` (su vínculo local es tutor en algún `user_group`) o `manual` (marcado intocable en `moodle_protected_user` vía `POST/DELETE api/moodle-audit/protected/:moodleId`; clave por moodle_id porque puede no tener vínculo local). Los docentes matriculados nunca llegan aquí (tienen cursos); la protección cubre cuentas de gestión sin matrículas.
- **moodleCourses** (informe, no es un finding): catálogo de cursos del snapshot de matrículas cruzado con `courses.moodle_id` (visible, fechas, matriculados, curso local o «no importado»). **Solo informativo**: el borrado/archivado de cursos se hace desde la propia Moodle, la herramienta no toca cursos.

Todo el cruce es **bulk** (9 consultas agrupadas, nada por-usuario).

## Lógica de DNI compartida
`server/src/api/moodle/moodle-user-matching.util.ts` (`moodleUserDniVariants`/`moodleUserDniKeys`/`moodleUserDniToStore`/`compactDniKey`) es la única fuente del matching Moodle→DNI; `MoodleService` delega en ella (sus métodos privados quedaron como wrappers). Si se cambia el matching del import, la auditoría cambia con él.

## Reparación
- **Vínculos incorrectos**, dos acciones según el caso:
  - **Reasignar → `POST api/moodle-audit/relink/:idMoodleUser`** (recomendada cuando linkedUser y expectedUser son personas **distintas** y solo el vínculo está mal): mueve al usuario correcto por DNI **solo** la cuenta de Moodle y lo que vino de ella — las filas `user_course` con ese `id_moodle_user` (fusionando con `mergeUserCourseRow` si el destino ya tiene el curso) y las membresías `user_group` de los grupos de esos cursos (`mergeUserGroupRow` en colisión); el import de Moodle crea ambas al matricular, por eso van juntas. Nadie se borra; el resto de datos del mal vinculado queda intacto. Destino server-authoritative: se deriva de los `dni_keys` del snapshot (mismo matching que la clasificación); rechaza huérfanos, cuentas sin DNI y vínculos ya correctos. `is_main_user` coherente en ambos lados (promoción en el origen como en huérfanos; principal en destino solo si no tenía). Transaccional, 0 llamadas.
  - **Fusionar →** (cuando las dos fichas son la **misma persona** duplicada): reutiliza la Fusión de duplicados (`docs/user-merge.md`): abre el `MergeModal` (exportado desde `MergeDuplicates.tsx`) con ganador = usuario por DNI y perdedor = vinculado; absorbe TODO y borra al perdedor. `useMergeMutation` invalida también `["moodle-audit-report"]`.
- **Usernames desactualizados → `POST api/moodle-audit/fix-usernames`** (body opcional `{ idMoodleUsers: number[] }`; sin body corrige todos): **server-authoritative** — el cliente solo elige qué vínculos, el valor sale siempre del snapshot. `moodle_username` es UNIQUE y los desfases forman cadenas/intercambios, así que en una transacción se renombran primero todos los objetivos a un temporal (`#tmp-username-sync#<id>`) y luego se asigna el real; los conflictos con vínculos NO objetivo se detectan en memoria y vuelven como `errors` sin abortar nada. Hace lo mismo que el legacy `syncUsernamesFromMoodle` pero sin re-descargar de Moodle y con manejo de colisiones del unique.
- **Huérfanos → `DELETE api/moodle-audit/orphans/:idMoodleUser`** (ID en ruta para `audit_log`): transaccional — `user_course.id_moodle_user → NULL` (conserva matrícula/progreso), borra `moodle_user_auth_user`, borra la fila `moodle_users`, y promueve otra cuenta del usuario a `is_main_user` si la borrada lo era. Exige snapshot en memoria y verifica que el `moodle_id` no esté en él (los `moodle_id` no se reutilizan → un huérfano lo es para siempre; no hace falta re-descargar antes de borrar).
- **Limpieza de Moodle → `POST api/moodle-audit/delete-users`** (body `{ moodleIds }` = IDs **de Moodle**): borra EN Moodle con `core_user_delete_users` en lotes de 200 (~1 llamada/lote, irreversible: Moodle marca deleted=1 y anonimiza). Server-authoritative: recalcula los candidatos con `buildReport()` y rechaza por fila (sin abortar el lote) los que tienen cursos, no existen en el snapshot o están `protected`. `core_user_delete_users` es **atómico por lote** (un admin de Moodle no matriculado, invisible para las protecciones locales, tumba el lote entero — errorcode `useradminodelete`): el lote fallido se reintenta por **bisección** hasta aislar a los culpables (~2·log2(n) llamadas extra por id conflictivo), que vuelven como error por fila. A los borrados con vínculo local se les marca la lápida (`deleted_in_moodle_at`) y se les saca del snapshot en memoria — el informe queda coherente sin re-descargar. `MoodleService.request` propaga el `message` humano de los errores de Moodle (no la clase de la excepción) y redacta el `wstoken` en los logs.

## Endpoints (`@Controller("api/moodle-audit")`, `RoleGuard([ADMIN])`)
Prefijo `api/` en el decorador (convención `getApiHost()`).
- `GET /api/moodle-audit/report` — informe recalculado contra la BD local (0 llamadas; `hasSnapshot=false` si no hay snapshot).
- `POST /api/moodle-audit/refresh` — descarga el snapshot y devuelve el informe (POST a propósito: consume cuota y queda en `audit_log`).
- `POST /api/moodle-audit/fix-usernames` — corrige usernames desactualizados (todos o los del body).
- `POST /api/moodle-audit/relink/:idMoodleUser` — reasigna un vínculo incorrecto al usuario correcto por DNI sin fusionar fichas.
- `DELETE /api/moodle-audit/orphans/:idMoodleUser` — limpieza de un huérfano.
- `POST /api/moodle-audit/refresh-enrolments` — descarga el snapshot de matrículas (1 + C llamadas).
- `POST /api/moodle-audit/sync-status` — sincroniza `suspended`/lápidas a la BD (0 llamadas).
- `POST /api/moodle-audit/delete-users` — borra usuarios en Moodle (irreversible) y marca lápidas.
- `POST /api/moodle-audit/protected/:moodleId` / `DELETE .../protected/:moodleId` — marca/desmarca una cuenta como intocable (idempotentes).

**Funciones WS que el token de Moodle debe tener habilitadas**: `core_user_get_users`, `core_user_get_users_by_field`, `core_course_get_courses`, `core_enrol_get_enrolled_users` (las 4 ya usadas por los imports) y `core_user_delete_users` (nueva; además el usuario del token necesita la capability `moodle/user:delete`).

## Cliente
Tool **Auditoría de Moodle** (`/tools/moodle-audit`, admin) en "Herramientas" (`ToolList.tsx`). `MoodleAudit.tsx` + hooks `hooks/api/moodle-audit/useMoodleAudit.ts` (query `["moodle-audit-report"]`; el refresh hace `setQueryData` con el informe devuelto). Cabecera con estado de ambos snapshots + botones "Recalcular (sin llamadas)", "Sincronizar estado a la BD" y "Descargar de Moodle" (con `modal.confirm` avisando del coste); pestañas `RouteTabs` (`incorrectos`/`usernames`/`huerfanos`/`no-verificables`/`sin-cursos`/`sin-vinculo`/`limpieza`/`cursos-moodle`). Cada pestaña abre con un `Alert` explicativo con ejemplo y guía de decisión (qué acción tomar y cuándo no tocar). La pestaña `limpieza` pide descargar matrículas si faltan, filtra por actividad en cliente (nunca conectado / >6/12/24 meses), deshabilita el checkbox de los `protected`, tiene botón «Proteger»/«Desproteger» (intocables) y borra con doble validación (cliente deshabilita, servidor rechaza). `cursos-moodle` es solo lectura (ordenable por fin/matriculados, cruce con el curso local vía `openDetail`).

La ficha de usuario (`moodle-users-section.tsx`) muestra el estado de cada cuenta a partir de las columnas sincronizadas: «activa» (verde), «suspendida» (gris, username en gris claro), «eliminada en Moodle» (rojo, username tachado, botón de sync deshabilitado y sin «Hacer principal»). Usernames y huérfanos con selección múltiple (usernames en un solo POST; huérfanos con borrado secuencial) — por eso esa tabla no usa `getRowUrl`; los usuarios locales se abren vía `openDetail`. Los DNI con letra de control inválida se muestran en rojo/negrita (`DniText`, valida con `detectDocumentType` de `utils/detect-document-type.ts`).

## Tests / gotchas
- `moodle-audit.util.spec.ts` cubre la clasificación, las claves DNI y los candidatos a limpieza (20 tests). El servicio (SQL bulk + snapshot) no tiene unit tests (necesitaría Postgres real, como user-merge).
- Si el mismo usuario aparece en "incorrectos" y "huérfanos", **fusionar primero**: la fusión recoloca los `moodle_users` y puede resolver el huérfano.
- El informe se recalcula en cada `GET` (barato, local): tras una fusión o limpieza basta invalidar la query, sin tocar Moodle.
