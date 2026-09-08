# Catálogo de cursos

**Leer antes de tocar `api/course-catalog/`, `catalog_courses`, la creación/importación de cursos o las pantallas de catálogo.**

## Modelo

AcademyHub separa la identidad estable de una formación de cada ejecución concreta:

- `catalog_courses`: curso de catálogo visible para el usuario (p. ej. «Manipulador de alimentos»). Puede existir sin ediciones.
- `courses`: edición/convocatoria concreta, con fechas, Moodle, expediente, cliente y financiación.
- `groups`: grupos de participantes dentro de una edición.

`courses.id_catalog_course` es obligatorio. Las altas manuales deben seleccionarlo; Moodle e INAEM usan `CatalogCourseRepository.ensurePendingByName` para reutilizar el nombre normalizado o crear una entrada nueva sin detener la importación (el catálogo no distingue entradas autocreadas de las dadas de alta a mano — no hay campo de revisión, ver más abajo).

`catalog_courses.normalized_name` es único y se calcula con `normalizeCourseCatalogName` (sin acentos, espacios colapsados y mayúsculas). El nombre es canónico; los nombres de las ediciones siguen siendo fotografías históricas. Los alias se han diferido a una última fase de mejora de experiencia.

## Datos del catálogo

Nombre, código interno opcional, descripción, objetivos, contenidos base, modalidad/horas habituales, referencia de especialidad SEPE y familia/área profesional. Los valores habituales son informativos: no reescriben ediciones existentes.

`catalog_courses.contents` (HTML largo, pestaña propia **Contenidos** en la ficha del catálogo) es el temario real de la formación, compartido por todas sus ediciones — antes vivía duplicado en `courses.contents` por cada edición; la migración `0076` lo trasladó (backfill desde la edición con `start_date` más reciente que tuviera contenido, a igualdad `id_course` más alto) y `0077` borró la columna de `courses`. Es un campo distinto de `base_contents` (plantilla informativa de "contenidos habituales", sin editor HTML). Editable por ADMIN y MANAGER (el resto de la ficha del catálogo es solo-ADMIN, ver "API y permisos").

No tiene campo de estado/revisión: se eliminó (`catalog_courses.status`, enum `course_catalog_status`, migración `0067`) por no tener ningún consumidor real — nada lo filtraba salvo el selector de curso de catálogo al crear una edición, que ocultaba las entradas `INACTIVO` (también eliminado). El único estado "activo/inactivo" que existe ahora es el derivado por edición/grupo, ver "Cliente" más abajo.

`catalog_courses.hidden_from_filters` (booleano, migración `0078`, checkbox en "Datos generales", solo ADMIN) oculta el curso de catálogo de los **selects de filtro/búsqueda**: "Filtrar por curso de catálogo" en Peticiones (listado y pestaña Informes), el selector obligatorio al crear una petición nueva, y "Curso de catálogo" en Personas interesadas — cada uno filtra su propio `useCourseCatalogQuery()` con `.filter(c => !c.hidden_from_filters)` antes de construir las `options`. **No** afecta al listado `/course-catalog` (se muestra con una etiqueta "Oculto de filtros" en la columna Curso) ni al selector "Curso de catálogo" al crear/editar una edición (`create-course.route.tsx`/`course-detail.route.tsx`) — a diferencia del extinto `status`/`INACTIVO` de arriba, este campo deliberadamente no bloquea la creación de nuevas ediciones.

## Datos de planificación de la edición

`courses` guarda campos comunes a cualquier cliente: `capacity`, `selection_at`, `selection_place`, `training_place`, `target_audience`, `admission_requirements`, `required_documentation`, `planned_schedule`, `coordinator` y `organization_notes`. No viven en una tabla INAEM separada por si en el futuro hiciera falta también para FUNDAE/privada, pero de momento **solo se usan para financiación pública** (INAEM): la pestaña «Planificación y selección» de la edición solo se muestra si `funding = PUBLICA`, igual que «Candidatos».

## API y permisos

- `GET /course-catalog`, `GET /course-catalog/:id`: autenticados; lectura para todos los roles.
- `POST /course-catalog`, `PUT /course-catalog/:id`, `POST /course-catalog/:id/merge`: solo ADMIN.

Fusionar mueve todas las ediciones al destino y elimina el registro origen dentro de una transacción. No fusiona por nombre automáticamente.

## Cliente

- Menú lateral (`router.tsx`): «Cursos» (enlace directo a `/course-catalog`) es una cabecera de grupo (`type: 'group'`, no desplegable, sin flecha) de la que cuelgan siempre visibles «Ediciones» (`/courses`), «Grupos» (`/groups`) y «Peticiones» (`/course-requests`), en ese orden; «Empresas» (enlace directo a `/companies`) agrupa igual a «Centros» (`/centers`). El título del grupo es un `<Link>` reestilado (`.app-sider-group-title` en `index.css`) para que se vea y navegue como un ítem de menú normal, no como una etiqueta de sección apagada; los hijos llevan `className: 'app-sider-child-item'` (sangría extra vía `!important`, antd no los indenta más por defecto dentro de un grupo) para que se vean claramente colgando de su cabecera.
- Listado `/course-catalog` (`course-catalog.route.tsx`): como el catálogo no tiene fechas propias, su columna **Activo** y el orden (`Fecha Fin Grupo` descendente, más recientes primero) se derivan agregando `id_catalog_course → courses → groups` en el cliente (mismo criterio — `isGroupActive`/fecha de fin de grupo más reciente — que usaba el listado de Ediciones). No hay columna de revisión (campo eliminado, ver arriba).
- Listado `/courses` (`courses.route.tsx`, «Ediciones»): orden por defecto por `Fecha Fin Grupo` descendente (sin fecha al final) y, a igualdad, `id_course` descendente. Columnas reducidas a lo esencial (Curso de catálogo, Nº Exp./Cliente/Financiación según pestaña, Fecha Fin Grupo, Estado) — sin ID, ID Moodle, Nombre ni Nombre Corto (siguen siendo consultables desde la ficha de la edición).
- Ficha del catálogo (`catalog-course-detail.route.tsx`): pestañas Datos generales, Ediciones, Interesados y **Contenidos** (última) — se abre directamente en Ediciones (`defaultTabKey`). La pestaña Ediciones lista las ediciones ordenadas por fecha de inicio del grupo más reciente de cada una, descendente y, a igualdad, por `id_course` descendente; el nombre de cada edición lleva delante un `<YearTag>` con el año de esa fecha (ver `docs/client.md` "Tags"); sus columnas **Inicio**/**Fin** muestran las fechas de ese mismo grupo más reciente (`latestGroupByCourse`, no `course.start_date`/`end_date` — esos campos de la edición ya no se editan aquí, solo se leen del grupo).
- Alta/edición de una edición: curso de catálogo obligatorio; campos requeridos en la ficha general. «Planificación y selección» y «Candidatos» solo aparecen como pestañas si `funding = PUBLICA`.

## Migración inicial

`0063_narrow_namorita.sql` agrupa cursos existentes por nombre normalizado, crea un catálogo activo por grupo, rellena `id_catalog_course` y solo después aplica `NOT NULL` y la FK. Requiere la extensión `unaccent`, ya requerida por el proyecto.

## Candidatos vs. preinscripción oficial INAEM (fase 2)

Se separan dos conceptos que antes se mezclaban en una sola pestaña "Preinscripciones":

- **`course_candidates`**: gestión operativa interna de una persona para una edición concreta (contacto, requisitos, selección, asistencia, documentación). Se puede crear manualmente, desde un interés (fase 3, pendiente) o desde una importación. **No implica** que la persona conste oficialmente preinscrita en INAEM.
- **`user_preinscription`**: constancia oficial de que la persona figura como preinscrita/matriculada/descartada/baja en el expediente INAEM. Es la fuente de verdad para informes oficiales y **no debe inflarse** por seguimiento interno.

Ambas se unen por `(id_user, id_course)` y se muestran juntas en una única pestaña **Candidatos** en la ficha de la edición (`course-candidates-section.tsx`), con indicadores independientes: **estado del proceso/selección** (`process_status`: `PENDIENTE` por defecto, `SELECCIONADA`, `RESERVA`, `BAJA`, `DESCARTADA` — un único campo, no distingue "matriculada" porque ya está la situación INAEM), **asistencia a la prueba de selección** (`attendance_status`), **documentación aportada** (3 documentos independientes) y **situación INAEM** (vacío si no hay `user_preinscription`, o `PREINSCRITO`/`MATRICULADO`/`DESCARTADO`/`BAJA`).

No hay seguimiento estructurado (historial de llamadas/correos/próxima acción): se simplificó a un único cuadro grande de observaciones libres (`operational_notes`). La tabla `candidate_followups` y los campos `next_action`/`next_followup_at`/`last_contact_at` se eliminaron por no tener uso real (migración `0069`).

### `course_candidates` (tabla)

Clave única `(id_user, id_course)` — una persona solo puede tener una candidatura por edición. Campos: `source` (`MANUAL`/`EXCEL_OPERATIVO`/`INTERES_CURSO`/`IMPORTACION_INAEM`), `process_status` (`PENDIENTE`/`SELECCIONADA`/`RESERVA`/`BAJA`/`DESCARTADA` — fusiona lo que antes eran `process_status` y `selection_status` por separado, redundantes; migración `0072` renombró `NO_SELECCIONADA`→`DESCARTADA` y añadió `RESERVA`/`BAJA`), `employment_status`, `meets_requirements` (booleano nullable), `attendance_status` (`PENDIENTE`/`SI`/`NO` — confirmación de asistencia a la prueba de selección previa al curso; migración `0071` fusionó `CONFIRMADA`→`SI`, `RECHAZADA`→`NO`, `SIN_RESPUESTA`→`PENDIENTE`), `has_darde`/`has_dni`/`has_titulacion` (booleanos independientes — antes un único `documentation_status` que no permitía saber cuál de los tres documentos faltaba), `operational_notes` (cuadro libre de observaciones), `assigned_to` (→ `auth_user`), `created_by` (→ `auth_user`).

El nombre/DNI/teléfono/email mostrados vienen de `users` (join), no de esta tabla; se editan vía `PUT /user/:id` (ver "Cliente" más abajo) — el candidato en sí no duplica esos campos.

### `user_preinscription` — nuevos campos

`registration_source` (`IMPORTACION_INAEM`/`CONFIRMACION_MANUAL`), `registered_at`, `verified_at`, `verified_by` (→ `auth_user`). El servicio nunca crea `user_preinscription` a partir de una candidatura: solo se crea al importar el fichero oficial de preinscritos/alumnos INAEM. No hay ninguna acción manual desde el cliente para crearla o confirmarla (existió como "Confirmar alta" en `POST /course-candidates/:id/confirm-preinscription`; se eliminó por no hacer falta).

### Importación INAEM

`InaemImportService` crea/actualiza siempre primero el `course_candidates` (idempotente por `upsert`, `source=IMPORTACION_INAEM`) y después el `user_preinscription`: al importar preinscritos deja el candidato en su estado actual y crea/actualiza la preinscripción a `PREINSCRITO`; al importar alumnos la marca `MATRICULADO` (`markEnrolled`). Nunca toca `process_status` (redundante con la situación INAEM) ni sobrescribe seguimiento operativo ya introducido a mano.

### API (`@Controller("course-candidates")`)

`RoleGuard([ADMIN, MANAGER, VIEWER, TUTOR])` para lectura; escritura `[ADMIN, MANAGER, TUTOR]` (la pestaña Candidatos de una edición es la única excepción a "TUTOR = solo lectura": tiene las mismas funciones que MANAGER, incluida la edición inline de DNI/teléfono/email vía `PUT /user/:id`, que por tanto también admite TUTOR — ver "Cliente" más abajo).
- `GET ?id_course=` — listado unido con `users` y `user_preinscription` para la edición.
- `POST` — alta manual: `{ id_user, id_course, source? }` con un usuario existente, **o** `{ id_course, new_user: { name, first_surname?, second_surname?, dni?, phone?, email? } }` para crear el usuario y la candidatura a la vez (`CourseCandidateService.create` crea primero el `users` mínimo — `name` obligatorio, `phone` o `email` obligatorio para poder contactar, el resto opcional — vía `UserRepository.create`, valida con `BadRequestException` si falta alguno). Devuelve la fila unida (igual forma que `GET`) para que el cliente pueda enfocar la fila recién creada sin un segundo round-trip.
- `PUT /bulk` — edición masiva en transacción (`{ candidates: [{ id_candidate, ...campos }] }`); el cliente la usa para autoguardar cada cambio de celda (un elemento en el array), no como guardado por lote.
- `DELETE /:id?force=true` — solo si **no** existe `user_preinscription` asociada (409 en caso contrario: no se puede borrar constancia de preinscripción oficial); `force=true` la salta **y borra también la preinscripción oficial** (`UserPreinscriptionRepository.deleteByUserCourse`, en la misma transacción — no tendría sentido dejar una constancia INAEM huérfana sin candidatura detrás).
- DNI/teléfono/email se editan reutilizando `PUT /user/:id` (`api/user/`) — no hay endpoint propio; el cliente siempre incluye `name` en el body (el DTO lo exige) aunque solo cambie otro campo. Este endpoint es genérico (edita cualquier usuario desde cualquier punto de la app), así que admitir TUTOR ahí le da también permiso para editar esos mismos campos de cualquier usuario fuera de esta pestaña, no solo desde Candidatos — decisión asumida al extender el rol.
- `POST /course-interests/incorporate` (botón "Desde interesados", ver más abajo) también admite TUTOR por el mismo motivo.

### Borrado de la edición

`CourseService.getDeletionCheck` bloquea el borrado si existen `groups`, `preinscriptions` o `candidates` asociados (antes solo comprobaba grupos y preinscripciones).

### Fusión de usuarios

`UserMergeService` reasigna `course_candidates` del perdedor al ganador (`reassignCandidates`): si el ganador ya tiene candidatura para el mismo curso se fusionan los campos (conserva notas/estado más avanzado; los 3 booleanos de documentación se combinan con OR); si no, se mueve la fila completa. Ver `docs/user-merge.md`.

### Cliente

Pestaña **Candidatos** sustituye a la antigua "Preinscripciones" en la ficha de edición. Grid tipo hoja de cálculo con **autoguardado** (sin botón "Guardar", sin deshacer/rehacer): cada Select/Switch guarda al cambiar de valor; DNI/Teléfono/Email/Observaciones son campos de texto que guardan al perder el foco (`AutoSaveText`, componente **compartido** en `components/common/AutoSaveText.tsx` — mantiene el valor en estado local mientras se edita y solo llama a la mutación en `onBlur`, para no disparar una petición por cada tecla; reutilizado también por Interesados, ver más abajo). Sin paginación: se muestra todo el listado (`pagination={false}`).

Ambas mutaciones de autoguardado (`useUpdateCourseCandidatesMutation` para los Select/Switch, `useUpdateCandidateUserMutation` para dni/teléfono/email) son **optimistas**: aplican el cambio a la caché de React Query en `onMutate` (antes de que responda el servidor) y solo revierten (`onError`) si falla; `onSettled` siempre invalida para resincronizar con el servidor (recoge efectos secundarios como la reapertura de un interés). Sin esto, cada tecleo/click esperaba a recargar el listado completo (miles de filas en producción) antes de reflejarse, lo que se notaba como lentitud.

El DNI se valida **solo visualmente** con `detectDocumentType` (mismo validador de letra de control que el resto de la app — `MoodleAudit.tsx`, `BonificationModal.tsx`, etc.): si no es válido, el cajetín se pone en rojo (`status="error"`, recalculado en vivo mientras se escribe), pero se permite guardarlo igual — ni el cliente ni `PUT /user/:id` bloquean por formato, solo por la unicidad de la columna.

Columnas (de izda a dcha): INAEM, Candidato, DNI, Teléfono, Email, Estado laboral, Requisitos, DARDE, DNI/NIE, Titulación, Proceso, Prueba, Observaciones, Acciones — las de check (Requisitos/DARDE/DNI-NIE/Titulación) van al ancho mínimo (`Switch` sin etiqueta, ~60-75px); **Acciones** (borrar) no lleva título de columna.

**INAEM** (antes "Situación INAEM"): primera columna, muy estrecha (~55px), solo lectura. Un único carácter con tooltip — `M` (Matriculado, verde), `P` (Preinscrito, azul) o `-` (sin registro; también engloba `DESCARTADO`/`BAJA`, que ya no tienen símbolo propio en esta columna compacta — el estado completo, si hace falta detalle, sigue en `user_preinscription`/informes). Sin acción de confirmar/dar de alta manualmente (se quitó, ver arriba).

**Orden del listado** (`PROCESS_RANK` en el componente): matriculados (situación INAEM) primero, luego `SELECCIONADA` > `RESERVA` > `PENDIENTE` > `BAJA` > `DESCARTADA`. El único campo que reordena el listado es la columna **Estado** (`process_status` — llamada "Proceso" en el modelo/API, pero "Estado" en la UI): el resto (prueba, documentación, cumple requisitos, observaciones, dni/teléfono/email, estado laboral) no entra en el cálculo del rango, así que editarlos no mueve la fila. El Select de **Estado** usa color suave según valor (`.process-select-*` en `index.css`): gris/blanco pendiente, verde seleccionada, ámbar reserva, rosa baja, rojo descartada.

Columnas de check: **DARDE**/**DNI-NIE**/**Titulación** usan el azul/gris por defecto de antd (marcado/sin marcar). **Cumple Requisitos** (antes "Requisitos", ahora detrás de Titulación) es la excepción: verde si cumple, rojo si no (`.requirements-switch` en `index.css`, `!important` porque antd fija el color del `Switch` con más especificidad).

**Añadir candidato**: búsqueda y alta unificadas en un único formulario (ya no hay modos "Buscar existente"/"Crear nuevo" separados), vía `PersonSearchOrCreateModal` — componente **compartido** en `components/common/PersonSearchOrCreateModal.tsx`, reutilizado también por "Añadir interesado" (ver "Intereses formativos" más abajo). Un buscador arriba (`Select` con `filterOption={false}`, filtrado propio en cliente) muestra hasta 50 coincidencias — el backend `GET /user/lookup` amplía su proyección con `phone`/`email` para esto. El filtro parte el término escrito en palabras (`normalizeLoose` + `split`) y exige que **todas** aparezcan en el conjunto nombre+apellidos+DNI+email+teléfono de la persona (no que el término completo esté en un único campo): así "Juan García" encuentra a alguien con nombre "Juan" y apellido "García" aunque no estén juntos en ningún campo individual (nombre y apellidos van en columnas separadas en `users`). Si eliges una, los campos de abajo (Nombre, Apellido1, Apellido2, DNI, Teléfono, Email) se autorellenan y se **deshabilitan** (esa persona se edita desde su ficha, no aquí) y "Aceptar" crea la candidatura con su `id_user`. Si no seleccionas nada, esos mismos campos quedan editables para dar de alta a alguien nuevo (nombre obligatorio + teléfono o email obligatorio; el resto opcional) — "Aceptar" crea usuario + candidatura en la misma llamada vía `new_user`. Tras crear (por cualquiera de las dos vías), la fila se ancla al principio del listado (`justCreatedId`, rank `-1` en el sort, propio de `CourseCandidatesSection` — no del modal compartido) y se hace scroll + foco automático a su primera celda (`element.scrollIntoView` + `.focus()` sobre `tr[data-row-key="…"]`); en cuanto se edita cualquier campo de esa fila deja de estar anclada y pasa a ordenarse por su proceso/estado real como cualquier otra.

**`PersonSearchOrCreateModal`/`IncorporateModal` son componentes propios**, no JSX inline dentro de `CourseCandidatesSection`: su estado de formulario (búsqueda, nombre/apellidos/dni/teléfono/email, selección de intereses) vive en el hijo, no en el padre. Si viviera en el padre, cada tecla al escribir re-renderizaba la tabla completa de candidatos (cientos/miles de filas) — se notaba como lentitud severa al abrir/usar la modal. Al aislar el estado en un componente hijo, escribir ahí ya no toca al padre ni a la tabla (React no propaga renders de hijo a padre).

El botón de eliminar en **Acciones** se muestra siempre que `canEdit` (antes también exigía `!r.inaem_status`, ocultándolo sin explicación para cualquier candidato con preinscripción INAEM registrada — probablemente la mayoría en datos reales). Si la persona consta preinscrita en INAEM, la modal de confirmación muestra un aviso y un checkbox **"Forzar borrado (también borra la preinscripción oficial INAEM)"** (`removeCandidate` en el componente: `force` se captura en una variable local del closure desde el `onChange` del `Checkbox` y se lee en `onOk` — `Modal.confirm` es imperativo, no hay estado React vivo al que enlazar directamente). Sin marcarlo, el servidor sigue bloqueando (409) y el mensaje de error se muestra tal cual en el toast.

**Importar Excel** solo es visible para `ADMIN` (antes cualquiera con `canEdit`, que incluía `MANAGER`; TUTOR tampoco lo ve, igual que MANAGER); solo empareja por DNI contra usuarios **ya existentes** (no crea usuarios nuevos desde el Excel, a diferencia del alta manual).

`canEdit` que recibe `CourseCandidatesSection` se fija en `CourseDetailRoute` como `canEditCandidates = [ADMIN, MANAGER, TUTOR].includes(role)` — variable propia de esta pestaña, distinta del `canEdit` general de la ficha del curso (`[ADMIN, MANAGER]`, usado en el resto de pestañas: Ficha, Planificación). La Ficha incluye un enlace de solo lectura a los Contenidos del curso de catálogo (pestaña propia en `catalog-course-detail.route.tsx`, ver "Datos del catálogo" arriba) — la edición ya no tiene contenidos propios.

## Intereses formativos (fase 3)

Bolsa general de personas interesadas en un **curso de catálogo**, sin edición asignada. Modela el ciclo `Interés → Candidatura → Preinscripción oficial → Matrícula` descrito arriba: el interés existe cuando todavía no hay (o no conviene aún) una convocatoria concreta a la que apuntar a la persona.

### `course_interests` (tabla)

`id_catalog_course` (→ `catalog_courses`, obligatorio), `id_user`, `status` (`INTERESADO`/`CONTACTADO`/`CONVOCADO`/`MATRICULADO`/`DESCARTADO`), `interest_date`, `source` (`TELEFONO`/`WEB`/`PRESENCIAL`/`CENTRO`/`IMPORTACION`/`OTRO`), `preferred_modality`, `availability`, `notes`, `assigned_to`/`created_by` (→ `auth_user`), `closed_at`. Sin constraint de unicidad en BD: la regla "solo un interés abierto por persona y curso de catálogo" se aplica en `CourseInterestService.create` (`ConflictException` si ya hay uno en `INTERESADO`/`CONTACTADO`); los históricos cerrados sí se conservan sin límite.

`CONVOCADO` y `MATRICULADO` son estados derivados: solo los asigna el sistema (nunca el equipo a mano) — implican que ya existe una `course_candidates` real detrás, vía "Incorporar a edición" o la sincronización automática de importación INAEM (ver más abajo). `DESCARTADO` es una decisión manual explícita y bloqueada para siempre: ni la sincronización ni la importación la revierten.

`course_candidates.id_interest` (nullable, `onDelete: set null`) enlaza una candidatura con el interés del que procede, cuando lo hay.

### "Incorporar a edición" (`POST /course-interests/incorporate`)

Convierte una selección de intereses en candidaturas de una edición concreta, en una transacción: por cada interés crea/reutiliza (`upsert`) su `course_candidates` en esa edición (`source=INTERES_CURSO`, `id_interest` enlazado) y marca el interés como `CONVOCADO`. Rechaza (409) si algún interés no pertenece al mismo curso de catálogo que la edición, o si no está en `INTERESADO`/`CONTACTADO` (ya convocado/matriculado/descartado). Botón **"Desde interesados"** en la pestaña Candidatos de la edición (visible solo si la edición tiene curso de catálogo).

### Reapertura/creación automática de interés al descartar una candidatura

Cuando `PUT /course-candidates/bulk` cambia `process_status` de una candidatura, `CourseCandidateService.syncInterestOnStatusChange` mantiene sincronizado su interés de origen:

- **`DESCARTADA`** (único disparador; `PENDIENTE`/`SELECCIONADA`/`RESERVA`/`BAJA` no hacen nada — `RESERVA` sigue en proceso, `BAJA` suele ser decisión propia de la persona) → reabre el interés a `CONTACTADO` (no vuelve a `INTERESADO`: ya hubo contacto) con una nota automática (`Reabierto automáticamente — Descartada en <expediente/curso> (<fecha>)`); si la candidatura no tenía `id_interest` (se creó a mano, por Excel o por importación INAEM), se **crea uno nuevo** en `CONTACTADO` y se enlaza retroactivamente, para que la persona no se pierda de cara a la siguiente convocatoria.
- El cierre del interés a `MATRICULADO` **no** depende de `process_status` (se eliminó ese estado por redundante con la situación INAEM): lo hace directamente la importación INAEM (`InaemImportService.linkOpenInterest`, ver `docs/import-inaem.md`) o "Incorporar a edición" al matricular.

### Vinculación automática desde la importación INAEM

`InaemImportService.linkOpenInterest` cierra el mismo hueco que dejaba abierto la importación directa de un Excel oficial (sin pasar por "Incorporar a edición"): al crear/actualizar la `course_candidates` de una fila, si esa candidatura aún no tiene `id_interest` busca un interés abierto (`INTERESADO`/`CONTACTADO`) de la misma persona para el curso de catálogo de la edición y lo enlaza; después avanza su estado — `CONVOCADO` al importar Preinscripciones, `MATRICULADO` al importar Alumnos — igual que hace la sincronización manual. Nunca retrocede el estado (una reimportación de Preinscripciones tras Alumnos no baja un `MATRICULADO` a `CONVOCADO`) ni revierte un interés ya `DESCARTADO`.

### API (`@Controller("course-interests")`)

`RoleGuard([ADMIN, MANAGER, VIEWER, TUTOR])` para lectura; escritura `[ADMIN, MANAGER]`, salvo `POST` (alta) y `DELETE` (baja) que también admiten `TUTOR` — los tutores pueden dar de alta y eliminar interesados, pero no editar los campos de uno existente (`PUT /bulk`) ni incorporarlos a una edición (`POST /incorporate`).
- `GET ?id_catalog_course=` — listado de un curso de catálogo (pestaña Interesados). `GET ?status=&assigned_to=` (con o sin `id_catalog_course`) — listado global filtrable.
- `POST` — alta manual (`ADMIN`/`MANAGER`/`TUTOR`); 409 si ya hay un interés abierto para esa persona+curso.
- `PUT /bulk` — edición masiva en transacción (`{ interests: [{ id_interest, ...campos }] }`).
- `POST /incorporate` — `{ id_course, interest_ids }`, ver arriba.
- `DELETE /:id` (`ADMIN`/`MANAGER`/`TUTOR`) — 409 si el interés ya está `CONVOCADO`/`MATRICULADO` (ya se usó en una convocatoria).

### Fusión de cursos de catálogo

`CourseCatalogService.merge` traslada también `course_interests.id_catalog_course` del origen al destino (además de las ediciones), en la misma transacción y antes de borrar la fila `catalog_courses` origen — si no, la fila no podría borrarse por la FK.

### Fusión de usuarios

`UserMergeService.reassignInterests` reasigna `course_interests` del perdedor al ganador: si colisionan en el mismo curso de catálogo, repunta primero las `course_candidates.id_interest` que apuntaban al interés del perdedor (para no perder la trazabilidad al fusionarlo) y luego fusiona campos (estado más avanzado, notas concatenadas, fecha de interés más antigua) y borra la fila del perdedor; si no, mueve la fila completa. Ver `docs/user-merge.md`.

### Cliente

- Pestaña **Interesados** en la ficha del curso de catálogo (`course-interests-section.tsx`): misma filosofía tipo hoja de cálculo que Candidatos, incluido el **autoguardado** (sin botón "Guardar cambios", sin borrador local): Estado/Origen/Modalidad preferida guardan al cambiar de valor (`Select` → `onChange`) y Disponibilidad/Notas guardan al perder el foco vía el mismo `AutoSaveText` compartido que usa Candidatos. `useUpdateCourseInterestsMutation(catalogCourseId)` es **optimista** igual que en Candidatos: aplica el patch a la caché (`onMutate`, clave `["course-interests","catalog",id]`) antes de que responda el servidor, revierte en `onError` y siempre invalida en `onSettled`. "Añadir interesado" usa el mismo `PersonSearchOrCreateModal` compartido que Candidatos (`components/common/`) — buscar existente o dar de alta a alguien nuevo en el mismo formulario. `POST /course-interests` acepta `{ id_user, id_catalog_course, ... }` o `{ id_catalog_course, new_user: {...}, ... }`, igual patrón que `POST /course-candidates`.
  - `CourseInterestsSection` distingue `canEdit` (ADMIN/MANAGER: editar campos de una fila existente, importar/exportar Excel) de `canAdd` (ADMIN/MANAGER/TUTOR: botón "Añadir interesado" + modal, **y** el botón de eliminar en Acciones — alta/baja del listado), fijado en `CatalogCourseDetailRoute` (`canAddInterests`). Sin `canAdd` explícito el prop hace de alias de `canEdit` (mismo comportamiento en cualquier otro consumidor del componente).
- Listado global **Personas interesadas** (`/course-catalog/interests`, botón desde `/course-catalog`): filtra por curso de catálogo, estado y búsqueda por nombre/DNI.
- Botón **"Desde interesados"** en la pestaña Candidatos de una edición: modal con los intereses disponibles (`INTERESADO`/`CONTACTADO`) del curso de catálogo de esa edición, selección múltiple, incorpora en bloque.
