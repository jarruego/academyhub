# Auditoría de vínculos con Moodle

**Read before touching `api/moodle-audit/`.**

Herramienta admin que cruza **todos los usuarios de Moodle** con la BD local para detectar vínculos `moodle_users` incorrectos (los duplicados que creaban los imports antiguos con matching de DNI exacto), vínculos huérfanos y cuentas sin vincular — gastando el mínimo de llamadas a Moodle (cuota limitada).

## Modelo de coste (una sola descarga)
`MoodleAuditService.refreshSnapshot()` llama **una vez** a `MoodleService.getAllUsers()` (`1 + ceil(N/200)` llamadas; el coste real se mide con `moodleCallCount` y se muestra en la UI como `moodleCallsLastFetch`). El snapshot (proyección `AuditMoodleUser`) se **cachea en memoria del proceso**: el informe (`getReport`) y las reparaciones trabajan solo contra la BD local (0 llamadas). Se pierde al reiniciar el servidor (aceptado; en dev con watch-mode se pierde en cada guardado) — la UI lo indica y la descarga es explícita.

## Clasificación (`moodle-audit.util.ts`, pura, con tests)
`classifyMoodleLinks` cruza snapshot ↔ `moodle_users` por `moodle_id` y verifica por DNI usando `moodleUserDniKeys` (mismo origen que el matching del import: customfield `dni` → `username` si valida, ver abajo) contra `users.dni` normalizado (compacto-mayúsculas):
- **incorrectLinks**: vinculado al usuario local A pero el DNI casa con B → A es el duplicado probable; `nameMatch` compara los nombres normalizados de A y B.
- **unverifiable**: vinculado pero sin verificación posible (`no-dni` | `dni-not-found`).
- **orphans**: filas de `moodle_users` cuyo `moodle_id` no está en el snapshot (cuenta borrada en Moodle; `getAllUsers` filtra `deleted=0`, así que un *suspendido* NO es huérfano). Con contadores: `user_course_refs`, `token_links`, `other_accounts`.
- **noCourses**: vinculado y su usuario local tiene 0 filas en `user_course` (solo BD local: no consulta matrículas de Moodle, costaría llamadas).
- **unlinked**: cuentas de Moodle sin fila en `moodle_users`, con `wouldMatchUser` (a quién vincularía el próximo import).
- **usernameMismatches** (dimensión independiente, puede solaparse con las demás): el `moodle_username` guardado no coincide (comparación exacta) con el real del snapshot.

Todo el cruce es **bulk** (6 consultas agrupadas, nada por-usuario).

## Lógica de DNI compartida
`server/src/api/moodle/moodle-user-matching.util.ts` (`moodleUserDniVariants`/`moodleUserDniKeys`/`moodleUserDniToStore`/`compactDniKey`) es la única fuente del matching Moodle→DNI; `MoodleService` delega en ella (sus métodos privados quedaron como wrappers). Si se cambia el matching del import, la auditoría cambia con él.

## Reparación
- **Vínculos incorrectos**, dos acciones según el caso:
  - **Reasignar → `POST api/moodle-audit/relink/:idMoodleUser`** (recomendada cuando linkedUser y expectedUser son personas **distintas** y solo el vínculo está mal): mueve al usuario correcto por DNI **solo** la cuenta de Moodle y lo que vino de ella — las filas `user_course` con ese `id_moodle_user` (fusionando con `mergeUserCourseRow` si el destino ya tiene el curso) y las membresías `user_group` de los grupos de esos cursos (`mergeUserGroupRow` en colisión); el import de Moodle crea ambas al matricular, por eso van juntas. Nadie se borra; el resto de datos del mal vinculado queda intacto. Destino server-authoritative: se deriva de los `dni_keys` del snapshot (mismo matching que la clasificación); rechaza huérfanos, cuentas sin DNI y vínculos ya correctos. `is_main_user` coherente en ambos lados (promoción en el origen como en huérfanos; principal en destino solo si no tenía). Transaccional, 0 llamadas.
  - **Fusionar →** (cuando las dos fichas son la **misma persona** duplicada): reutiliza la Fusión de duplicados (`docs/user-merge.md`): abre el `MergeModal` (exportado desde `MergeDuplicates.tsx`) con ganador = usuario por DNI y perdedor = vinculado; absorbe TODO y borra al perdedor. `useMergeMutation` invalida también `["moodle-audit-report"]`.
- **Usernames desactualizados → `POST api/moodle-audit/fix-usernames`** (body opcional `{ idMoodleUsers: number[] }`; sin body corrige todos): **server-authoritative** — el cliente solo elige qué vínculos, el valor sale siempre del snapshot. `moodle_username` es UNIQUE y los desfases forman cadenas/intercambios, así que en una transacción se renombran primero todos los objetivos a un temporal (`#tmp-username-sync#<id>`) y luego se asigna el real; los conflictos con vínculos NO objetivo se detectan en memoria y vuelven como `errors` sin abortar nada. Hace lo mismo que el legacy `syncUsernamesFromMoodle` pero sin re-descargar de Moodle y con manejo de colisiones del unique.
- **Huérfanos → `DELETE api/moodle-audit/orphans/:idMoodleUser`** (ID en ruta para `audit_log`): transaccional — `user_course.id_moodle_user → NULL` (conserva matrícula/progreso), borra `moodle_user_auth_user`, borra la fila `moodle_users`, y promueve otra cuenta del usuario a `is_main_user` si la borrada lo era. Exige snapshot en memoria y verifica que el `moodle_id` no esté en él (los `moodle_id` no se reutilizan → un huérfano lo es para siempre; no hace falta re-descargar antes de borrar).

## Endpoints (`@Controller("api/moodle-audit")`, `RoleGuard([ADMIN])`)
Prefijo `api/` en el decorador (convención `getApiHost()`).
- `GET /api/moodle-audit/report` — informe recalculado contra la BD local (0 llamadas; `hasSnapshot=false` si no hay snapshot).
- `POST /api/moodle-audit/refresh` — descarga el snapshot y devuelve el informe (POST a propósito: consume cuota y queda en `audit_log`).
- `POST /api/moodle-audit/fix-usernames` — corrige usernames desactualizados (todos o los del body).
- `POST /api/moodle-audit/relink/:idMoodleUser` — reasigna un vínculo incorrecto al usuario correcto por DNI sin fusionar fichas.
- `DELETE /api/moodle-audit/orphans/:idMoodleUser` — limpieza de un huérfano.

## Cliente
Tool **Auditoría de Moodle** (`/tools/moodle-audit`, admin) en "Herramientas" (`ToolList.tsx`). `MoodleAudit.tsx` + hooks `hooks/api/moodle-audit/useMoodleAudit.ts` (query `["moodle-audit-report"]`; el refresh hace `setQueryData` con el informe devuelto). Cabecera con estado del snapshot + botones "Recalcular (sin llamadas)" y "Descargar de Moodle" (con `modal.confirm` avisando del coste); pestañas `RouteTabs` (`incorrectos`/`usernames`/`huerfanos`/`no-verificables`/`sin-cursos`/`sin-vinculo`). Usernames y huérfanos con selección múltiple (usernames en un solo POST; huérfanos con borrado secuencial) — por eso esa tabla no usa `getRowUrl`; los usuarios locales se abren vía `openDetail`. Los DNI con letra de control inválida se muestran en rojo/negrita (`DniText`, valida con `detectDocumentType` de `utils/detect-document-type.ts`).

## Tests / gotchas
- `moodle-audit.util.spec.ts` cubre la clasificación y las claves DNI (15 tests). El servicio (SQL bulk + snapshot) no tiene unit tests (necesitaría Postgres real, como user-merge).
- Si el mismo usuario aparece en "incorrectos" y "huérfanos", **fusionar primero**: la fusión recoloca los `moodle_users` y puede resolver el huérfano.
- El informe se recalcula en cada `GET` (barato, local): tras una fusión o limpieza basta invalidar la query, sin tocar Moodle.
