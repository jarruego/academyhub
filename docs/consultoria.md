# Consultoría (`api/consultoria`, en construcción — ver "Estado")

Nuevo apartado para que **Mecohisa** (la organización que presta el servicio
a través de la app) gestione la consultoría de formación con los centros de
un cliente. Acceso solo **ADMIN** y **CONSULTOR**. Cliente piloto:
**VITALIA**. Fase 1: auditoría de la formación (plan, evaluación de acciones,
evaluación de competencias, cuadro por centro).

No es solo un cuadro de mandos: es la **herramienta de registro** con la que
un centro sostiene, ante una auditoría, el cumplimiento de los requisitos de
formación y competencia de sus normas de gestión (ISO 9001, ISO 14001,
ISO 45001, SGE21, UNE 10002, UNE 158101, UNE 158201) — condiciona el diseño:
los datos tienen que quedar trazados y ser exportables como evidencia.

Read before touching `api/consultoria/`. Este doc recoge el **planteamiento
funcional** (ya cerrado con consultoría) y el **diseño técnico** (tablas,
guards, módulo, endpoints, frontend) — ver "Diseño técnico" más abajo.
En construcción desde 2026-09-15, pieza a pieza — ver "Estado" para qué hay
ya y qué falta antes de tocar nada.

## Modelo conceptual
- **Cliente** (nuevo, entidad propia de Consultoría): agrupa una o varias
  `companies` existentes y, por transitividad, sus `centers`. Hoy el modelo es
  plano (`centers.id_company`), sin nada que agrupe varias empresas bajo un
  cliente. Existe `courses.client` (enum `CourseClient`, incluye `VITALIA`)
  pero es solo una etiqueta a nivel de curso, no una entidad — no sirve como
  sustituto.
- **Acción formativa**: reutiliza/extiende el modelo de cursos — **cuelga de
  `catalog_courses`** (el curso, identidad estable), **no de `courses`** (una
  edición/convocación concreta). Corregido 2026-09-15: el primer diseño la
  ataba a una edición; era un error — Nombre/Horas/Modalidad/Objetivos/
  Dirigido a son propiedades del curso en general (no cambian de una
  convocatoria a otra), y qué ediciones/alumnos/centros concretos lo hicieron
  y cuándo es un cruce de datos para más adelante (cuadro de formación), no
  parte de "qué es esta acción".
  - Ya existen en `catalog_courses`: `name`, `default_hours` (= Horas),
    `default_modality` (= Modalidad, lista fija: Online/Presencial/Mixta),
    `objectives` (= Objetivos, **un único campo** — a petición de
    consultoría, sin separar específicos/generales), `id_category` (=
    Categoría, lista fija editable `course_categories`, núcleo, no solo
    Consultoría), y `target_audience` (= Dirigido a, **añadido 2026-09-15** —
    antes solo existía a nivel de edición).
  - Nuevo, propio de Consultoría: `origen` (propio/externo — una acción
    externa no lleva edición/grupo/matrícula real ni sync a Moodle) y
    `fecha` — **lista fija de valores**, no texto libre ni fecha real (p. ej.
    *A demanda*, *Según calendario central*, *Alta trabajador*, *En
    elaboración*, ampliable).
- **Plan de formación**: dos capas. La decisión última del plan es siempre
  del centro — Mecohisa no "planifica" por él, aunque en la práctica sea
  quien lo arranca. **Plan base**: el catálogo de Mecohisa pasa, en la
  práctica, a ser el plan de formación del centro (no una planificación
  aparte que se le añade) — es lo que permite que un centro tenga un plan
  que cumpla la norma aunque no habría construido uno por su cuenta; un
  único plan compartido por todos los centros del cliente, sin duplicar.
  **Formación propia de cada centro**: por encima del plan base, cada centro
  añade la suya (más catálogo, o externa) — y **ADMIN/CONSULTOR pueden darla
  de alta en nombre de un centro**, no tiene que hacerlo siempre el propio
  centro. Admite altas fuera de la campaña inicial, no es un bloque cerrado.
- **Auditoría anual** (nuevo, contenedor): una por centro y ejercicio, ciclo
  de vida borrador → abierta → cerrada. Agrupa el plan + evaluación de
  acciones + evaluación de competencias de ese año. Se cierra sola a los dos
  años de abrirse (red de seguridad), pero ADMIN y CONSULTOR pueden abrirla o
  cerrarla a mano en cualquier momento — el automatismo nunca bloquea la
  gestión manual.
- **Evaluación de acciones formativas**: acción, fecha, evaluación/motivo
  (texto libre — utilidad y cumplimiento del objetivo desde el punto de vista
  del cliente auditado, no la satisfacción del alumno), porcentaje (0-100),
  imparte (empresa/centro que imparte la acción). Dos campos separados a
  propósito: el texto explica el caso, el **porcentaje** lo hace explotable
  (filtrar/comprobar que toda evaluación `<50%` está justificada y con
  acción correctiva asociada). Evaluación progresiva según terminan las
  acciones, no un único corte anual; `<50%` exige motivos y medidas
  propuestas.
- **Cuadro de formación por centro**: cruce trabajador (DNI, nombre,
  apellidos, cargo) × acción, con fecha. Automático para formación propia ya
  registrada; ajuste manual del roster evaluado (añadir/quitar trabajador)
  sin tocar la asociación real centro–trabajador. Para añadir a alguien que
  falta se busca entre **todos** los trabajadores del sistema (no solo los
  del centro) por nombre, DNI, teléfono o email; si no consta asociado a
  este centro se añade igual, con un aviso visible (sin indicar de momento a
  qué centro pertenece realmente — pendiente de decidir si conviene
  mostrarlo). Mismo mecanismo de búsqueda/aviso reutilizado en evaluación de
  competencias. *(Fase siguiente, no esta fase 1)* Panel de altas/bajas más
  granular: gestión curso a curso de quién participó en cada acción
  formativa concreta — sirve de base para automatizar más el cruce y para
  llevar registro de asistencia por acción.
  - **Circuito de registro, en orden**: para una acción propia de un
    centro — 1) el centro la registra en su plan · 2) el centro la evalúa ·
    3) el centro registra los asistentes. Para un curso del catálogo de
    Mecohisa — 1) petición/matrícula (circuito ya existente fuera de
    Consultoría) · 2) el centro evalúa · 3) **Mecohisa** registra a los
    alumnos (ya tiene esos datos de la matrícula real), no el centro.
    Posibles avisos recordatorios si falta algún paso (relacionado con los
    avisos proactivos de "Mejoras futuras").
  - **Registrar asistentes es seleccionar, nunca crear**: solo se puede
    anotar como asistente a un trabajador que ya existe como `user` en la
    base de datos — misma búsqueda por nombre/DNI/teléfono/email que el
    ajuste manual del roster, arriba. Si la persona no está dada de alta en
    el sistema, no se puede registrar desde Consultoría; tiene que existir
    antes por la vía habitual de la aplicación.
  - **Caso excepcional — formación presencial de Marisa** (personal de
    Mecohisa que a veces organiza formación presencial propia sin catalogar
    todavía): Marisa registra la acción en el plan (con fecha), el centro la
    evalúa igual que el resto, y Marisa puede registrar también a los
    asistentes (sujeto también a que ya existan como usuarios) — asume los
    pasos 1 y 3 en este caso. No es un tercer origen: sigue siendo una acción
    **propia** de Mecohisa, solo que probablemente con un entorno de alta más
    amigable y sencillo que el alta de catálogo completa de ADMIN/CONSULTOR
    (a concretar en el diseño técnico).
- **Evaluación de competencias**: 25 competencias fijas por trabajador,
  escala `1` (no necesita mejorar) / `0` (necesita mejorar) / en blanco (no
  aplica al puesto). Periodicidad libre; hábito anual en diciembre salvo
  altas o cambios de puesto. El roster de cada ejercicio lo fija la
  auditoría anual del centro: entran los trabajadores activos entre el 1 de
  enero y el 31 de diciembre de ese año, y también quien causó baja dentro
  de ese mismo ejercicio (quien causó baja antes no entra); más el añadido
  manual por búsqueda descrito arriba. Plantillas por puesto de trabajo (28
  puestos) autorellenan la evaluación, editable; configurador administrado
  por ADMIN y CONSULTOR. Pantalla de evaluación (paso a paso / vista global /
  otra): sin decidir.
- **Acceso externo de centros**: token opaco aleatorio (no JWT), hasheado en
  BD, resuelto en servidor al centro; único token por centro; revocable y
  regenerable al instante desde la ficha del centro. Atado al estado de la
  auditoría anual de ese centro (§ auditoría anual): edita mientras está
  abierta, pasa a solo lectura al cerrarla. El centro usa este acceso para
  evaluar sus acciones, evaluar competencias, y registrar a los asistentes
  de sus propias acciones (paso 3 del circuito de arriba — no de las de
  catálogo de Mecohisa). Alcance cerrado a los datos de ese centro, sin
  exportaciones masivas ni navegación a otros centros; cambios auditados.
  Implementación exacta (hash, longitud, middleware): en el diseño técnico.

## Dashboards auditables (objetivo de consultoría)
Fase 1 no está completa hasta que existan estos 4 informes, exportables como
evidencia de auditoría (ver la motivación normativa al principio del doc):

1. **Plan de Formación Anual** — sale de § Plan de formación (base + propio
   de cada centro).
2. **Evaluación de las Acciones Formativas Realizadas** — sale de §
   Evaluación de acciones formativas, con el filtro "`<50%` con
   justificación" que da el campo Porcentaje.
3. **Registro de Alumnos Formados** (3 años + año en curso) — sale del
   Cuadro de formación por centro. *Pendiente:* ¿agrega varias auditorías
   anuales de un centro (3 cerradas + la actual) o es una ventana fija de 4
   años natural, con o sin auditoría para esos años? **Dato nuevo:** el
   informe/estadísticas real que usa consultoría hoy mantiene **10 años**
   de histórico (2016-2025), no 4 — a tener en cuenta al cerrar esta
   pregunta (ver análisis de los ficheros de consultoría, § Mejoras
   futuras).
4. **Evaluación de Competencias por Puesto de Trabajo** — sale de §
   Evaluación de competencias. *Pendiente:* ¿tabla por trabajador filtrable
   por puesto, o vista agregada (% de necesidad de mejora por competencia y
   puesto, sin bajar a cada trabajador)?

*Pendiente:* consultoría mencionó un informe y unas tablas propias que usan
hoy, para reflejar su estructura en estos 4 dashboards — no ha llegado
todavía.

## Decisiones cerradas
- Cliente = entidad nueva en Consultoría (no se amplía el modelo core de
  empresa/centro).
- Auditoría anual = contenedor con estado por centro, creación **automática**
  (proceso programado al iniciar el ejercicio; un centro incorporado a mitad
  de año recibe la suya en el momento del alta) y **cierre automático a los
  dos años** como red de seguridad. A partir de ahí, ADMIN y CONSULTOR pueden
  gestionarla a mano en cualquier momento (reabrir, cerrar antes de tiempo,
  ajustar fechas) — lo automático es el valor por defecto, nunca un bloqueo.
- Roster de la evaluación de competencias por ejercicio = trabajadores
  activos entre el 1 de enero y el 31 de diciembre de ese año + bajas dentro
  del ejercicio (quien causó baja antes no entra); ampliable a mano buscando
  por nombre/DNI/teléfono/email entre todos los trabajadores del sistema,
  con aviso si no constan de este centro.
- Plan base compartido por todos los centros del cliente, no duplicado.
  Selección de cursos hacia el plan: buscador con autocompletado sobre el
  catálogo, reutilizando el selector de curso que ya existe en otros flujos.
  Clonable de un año a otro como punto de partida editable.
- Altas de acciones formativas de un centro: **sin validación bloqueante**;
  entran directas al plan/cuadro, con una bandeja de revisión opcional para
  ADMIN/CONSULTOR.
- Acciones formativas reutilizan el modelo de cursos existente, con flag de
  origen (propio/externo).
- Categoría pasa de texto libre a **lista fija gestionable** (Modalidad ya
  era lista fija: Online/Presencial/Mixta).
- "Evaluación/Motivo" de la evaluación de acciones: se mantiene como **dos
  campos** (texto libre + Porcentaje numérico), sin partir el texto en más
  subcampos.
- Formación externa en el cuadro: solo entra si se registra como acción
  formativa (origen=externo); no se admite formación suelta sin pasar por
  el modelo de acción. Circuito de registro en tres pasos según origen
  (detallado arriba), con la excepción de Marisa.
- Configurador de plantillas puesto↔competencia: ADMIN y CONSULTOR.
- Campo "Imparte" = empresa/centro de formación que imparte la acción.
- Objetivos = un único campo (no específicos/generales separados); Categoría
  y Fecha pasan a listas fijas gestionables (Fecha no es una fecha real).
- ADMIN y CONSULTOR pueden dar de alta formación en nombre de un centro.
- El caso de Marisa (formación presencial de Mecohisa sin catalogar) no es
  un tercer origen — sigue siendo acción propia, con un alta más sencilla.

## Diseño técnico

Primera pasada, basada en investigar las convenciones reales del código
(módulos NestJS, guards, esquema, router del cliente) antes de proponer
nada — no hay precedente en este proyecto para dos piezas de este diseño
(acceso público por token, catálogo editable sin migración), así que se
marcan explícitamente como infraestructura nueva.

### Decisiones técnicas cerradas
- **Plan continuo, no versionado por ejercicio**: una sola lista de acciones
  por cliente (`consulting_plan_items`) que crece con el tiempo, sin columna
  de año. "Clonable" es una acción de servicio (`cloneItemsTo`), no un
  concepto del modelo — copia la lista de un cliente a otro (o la resetea)
  como punto de partida editable.
- **Categoría y Fecha de la acción = tabla catálogo editable por ADMIN**,
  no un enum de Postgres — primera vez en este código que una lista de
  valores se gestiona desde una pantalla en vez de una migración.
  **Actualizado 2026-09-15**: Categoría se implementó como `course_categories`
  **del núcleo de cursos**, no como catálogo propio de Consultoría —
  `courses.category` (texto libre, 0 valores reales, sin pantalla) se
  eliminó. Gestión ADMIN-only (`api/course-categories`); Consultoría solo la
  consume. Ver `docs/architecture.md` § Course typology. Fecha sigue siendo
  `consulting_planning_dates`, propio de Consultoría (no tiene sentido fuera
  de ese contexto).
- **La acción formativa cuelga de `catalog_courses`, no de `courses`**
  (corregido 2026-09-15 — ver "Modelo conceptual" arriba). Consecuencia: la
  tabla satélite se queda en casi nada — `consulting_action_details`
  (`id_catalog_course` PK/FK, `origin`, `id_category`, `id_planning_date`,
  `created_by`) — Objetivos, Horas, Modalidad y Dirigido a se leen
  directamente de `catalog_courses`, sin duplicarlos. `target_audience`
  (Dirigido a) se añadió a `catalog_courses` por el mismo motivo que
  Categoría: es una primera prueba de campo — se detectó y se revirtió un
  intento fallido de poner `id_category` a nivel de **edición**
  (`courses.id_category`) que se quedó sin usar en cuanto la acción pasó a
  vivir en el catálogo; no volver a cometer ese error si se añade algo más
  aquí — pensar primero si el campo es del curso (catálogo) o de la
  convocatoria (edición).
- **Acceso externo del centro = usuario técnico sin login** en `auth_users`
  por centro. El guard nuevo resuelve el token y rellena `request['user']`
  igual que `AuthGuard` — así el `audit_log`/`AuditInterceptor` existentes
  capturan sus cambios sin tocar nada. Contrapartida: hace falta poder
  distinguirlos de usuarios reales en las pantallas de Gestión de usuarios
  (ver más abajo).
- **Token del centro en el mismo sitio que el JWT**: `Authorization: Bearer
  <token>`, no una cabecera nueva — el cliente ya tiene un hook
  (`use-authenticated-axios.util.ts`) montado sobre esa cabecera; el acceso
  externo usa una variante ligera del mismo, cambiando solo de dónde saca el
  valor. Sin ambigüedad con el JWT normal porque `ConsultingTokenGuard` solo
  se monta en las rutas del centro, nunca en las internas.
- **Grupo de menú "Consultoría" con el mismo patrón que "Cursos"/"Empresas"**
  en `router.tsx`: condicional en línea sobre el rol
  (`role?.toLowerCase() === Role.ADMIN || role?.toLowerCase() ===
  Role.CONSULTOR`), no `AuthzHide` — comprobado, el sidebar no usa ese
  componente para sus grupos, los construye así los dos que ya existen.
- **Alias de puesto de trabajo** (`consulting_job_position_aliases`):
  `job_position` es texto libre y poco fiable ("Gerocultor/a" vs
  "gerocultora" vs "GEROCULTOR"...) — comparar contra el nombre del catálogo
  no es suficiente. En vez de intentar adivinar, una tabla de alias
  (valor tal cual aparece en `job_position` → puesto del catálogo de 28) que
  mantiene **solo ADMIN**, con una pantalla que lista los valores de
  `job_position` que todavía no tienen alias — se resuelven una vez y quedan
  memorizados. Mismo patrón que ya usa la importación de Peticiones de
  centros para hacer matching de columnas de Excel por alias
  (`course-request-column-map.ts`).

### Modelo de datos (Drizzle, `academyhubSchema`, nombres en inglés — igual que el resto del esquema)

| Tabla | Qué guarda |
|---|---|
| `consulting_clients` | Cliente a auditar: `id`, `name`. |
| `consulting_client_companies` | Empresas de un cliente: `id_consulting_client`, `id_company` (único por par). |
| `consulting_action_details` | **Ya implementada** (2026-09-15). 1:1 con `catalog_courses` (no con `courses`/edición): `id_catalog_course` (PK/FK), `origin` (enum `OWN`/`EXTERNAL`), `id_category` (FK), `id_planning_date` (FK), `created_by` (nullable — null si lo creó el token del centro). Objetivos/Horas/Modalidad/Dirigido a **no** van aquí — se leen directamente de `catalog_courses` (núcleo, ver abajo). |
| `course_categories` *(núcleo, no `consulting_*`)* | **Ya implementada.** Catálogo editable ADMIN-only: `id_category`, `name`, `active`, `display_order`. Referenciada por `consulting_action_details.id_category`. Ver `docs/architecture.md`. |
| `consulting_planning_dates` | **Ya implementada.** Catálogo editable ADMIN-only: `id_planning_date`, `name` (*A demanda*, *Según calendario central*...), `active`, `display_order`. |
| `consulting_annual_audits` | `id`, `id_center`, `year`, `status` (`DRAFT`/`OPEN`/`CLOSED`), `opened_at`, `closed_at`, `auto_close_at` (`opened_at` + 2 años), `created_by`. |
| `consulting_plan_items` | `id`, `id_consulting_client`, `id_center` (nullable — NULL = plan base compartido), **`id_catalog_course`** (no `id_course` — el plan lista acciones formativas, que son de catálogo), `added_by` (nullable), `added_at`. |
| `consulting_action_evaluations` | `id`, **`id_catalog_course`** (no `id_course`, mismo motivo), `id_center`, `id_annual_audit`, `evaluation_date`, `evaluation_text`, `percentage` (0-100, nullable si se anula), `imparte_text`, `evaluated_by` (nullable), `created_at`. |
| `consulting_roster_adjustments` | Ajuste manual del cuadro/competencias: `id`, `id_center`, `id_user`, `adjustment_type` (`ADD`/`REMOVE`), `created_by`, `created_at`. |
| `consulting_competencies` | Catálogo de 25: `id`, `name`, `display_order`. |
| `consulting_job_positions` | Catálogo de 28: `id`, `name`, `group_label`, `display_order`. |
| `consulting_job_position_aliases` | `job_position` (texto, tal cual aparece en `user`) → `id_job_position`. Mantenida por ADMIN. |
| `consulting_position_competency_templates` | Configurador: `id_job_position`, `id_competency`, `default_value` (1/0/NULL), único por par. |
| `consulting_competency_evaluations` | `id`, `id_user`, `id_center`, `id_competency`, `id_annual_audit`, `value` (1/0/NULL), `evaluated_at`, `evaluated_by` (nullable). |
| `consulting_center_tokens` | `id_center` (único), `token_hash`, `created_at`, `last_used_at`, `revoked_at`. |

Notas:
- `id_annual_audit` en evaluaciones es explícito (no derivado en cada query) para que los 4 dashboards no tengan que recalcular a qué ejercicio pertenece cada fila — el servicio lo resuelve solo al crear la evaluación, a partir de `id_center` + fecha.
- **`user.job_position` ya existe** (texto libre) — se usa como señal para el autorelleno de la plantilla por puesto, resuelto vía `consulting_job_position_aliases` (no comparando texto directamente contra `consulting_job_positions.name`, poco fiable). Si el valor de `job_position` no tiene alias todavía, se autorellena vacío y se avisa, sin bloquear — queda listado para que ADMIN lo mapee.
- Consecuencia de "usuario técnico por centro": añadir `auth_users.is_service_account` (boolean, default `false`) para poder filtrarlos por defecto de `/auth-users` y de cualquier listado de usuarios — a validar con `docs/security.md`/`docs/permissions-matrix.md` al implementarlo.

### Guards y acceso externo

**No hay precedente de acceso público por token en este código** (se comprobó — el único `@Public()` existente es login y descarga de ficheros; el "token" de `docs/mail-moodle.md` es un token de servidor→Moodle, no de visitante→servidor). Es infraestructura nueva:

- `ConsultingTokenGuard` (nuevo, junto a `AuthGuard`): lee el token de `Authorization: Bearer <token>` (no de la URL de cada llamada a la API — el enlace humano sí lo lleva en la URL, pero el cliente lo reenvía por esa cabecera, igual que el JWT normal, vía una variante de `use-authenticated-axios.util.ts`), lo hashea, lo resuelve contra `consulting_center_tokens`, comprueba `revoked_at IS NULL`, y rellena `request['user']` con el usuario técnico del centro — igual que hace `AuthGuard` con un login normal. Comprueba también el estado de la auditoría anual del centro: si está `CLOSED`, solo permite lectura.
- Enlace humano: `https://<app>/consultoria-centro/:token` — ruta de cliente sin el layout/sidebar normal, que guarda el token y lo usa en cabecera para sus llamadas a `api/consultoria/centro/...`.
- Endpoints internos (ADMIN/CONSULTOR): `@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))` a nivel de controlador, mismo patrón que `course-request.controller.ts`. `CONSULTOR` hoy tiene los mismos privilegios que `VIEWER` (comentario en `role.enum.ts`) — Consultoría es el primer módulo que le da permisos reales.

### Módulo (NestJS), siguiendo el patrón de `course-request`

`server/src/api/consultoria/` — un controlador por área (cliente, acción/catálogo, plan, auditoría anual, evaluación de acciones, cuadro/roster, competencias, dashboards, y uno aparte para el acceso externo del centro), servicios junto a cada controlador, DTOs en `dto/`. Repositorios en `server/src/database/repository/consultoria/`. Registrado en `imports` de `server/src/api/api.module.ts` (no en `app.module.ts`).

Apertura/cierre automático de la auditoría anual: tarea programada siguiendo el patrón ya usado por el scheduler de importación SAGE (`SchedulerModule`, variable de entorno de cron propia si hace falta) — abre al empezar el año natural, cierra a los 2 de su apertura.

### Frontend

- Grupo nuevo en el sidebar, "Consultoría" (`client/src/router.tsx`) — grupo sin página propia (solo etiqueta, no `<Link>`), con "Clientes" y "Acciones formativas" como hijos reales; visibilidad `role?.toLowerCase() === Role.ADMIN || role?.toLowerCase() === Role.CONSULTOR`.
- **Ya implementadas**: `/consultoria` (listado de clientes) → `/consultoria/clients/:id` (ficha, pestañas Cliente/Empresas); `/consultoria/actions` (listado de acciones formativas ya etiquetadas) → `/consultoria/actions/add` y `/consultoria/actions/:id_catalog_course` (buscar/editar un curso de catálogo — datos del curso en solo lectura con enlace a su ficha, Origen/Categoría/Fecha editables; "+ Añadir" en los desplegables de Categoría/Fecha para ADMIN cuando el catálogo está vacío).
- Rutas internas pendientes: `/consultoria/clients/:id` ganará pestañas de plan, auditorías, evaluación de acciones, cuadro y competencias a medida que se construyan.
- Ruta externa del centro: `/consultoria-centro/:token`, layout propio sin sidebar.
- Empresas/Centros no tienen hoy ninguna pantalla de agrupación (son recursos planos bajo "Empresas") — Cliente no se cuelga de esas pantallas, tiene las suyas propias, referenciando empresas/centros por id.
- Pantalla ADMIN "Puestos sin mapear": lista los valores de `job_position` sin alias todavía, con selector del puesto del catálogo al que corresponden.

### Al implementar (recordatorios de CLAUDE.md)
- Cada `RoleGuard`/`@Public()` nuevo → actualizar `docs/permissions-matrix.md` **y** `permissions-matrix.content.ts` a la vez.
- Cada tabla nueva → `npm run db:generate`, revisar el SQL generado, `npm run db:migrate`.
- DTOs con `class-validator` en todos los endpoints (el `ValidationPipe` global ya limpia campos desconocidos).

## Decisiones pendientes
Negocio: consultoría dio el **visto bueno final** (§ Modelo conceptual y
Decisiones cerradas). Solo quedan los 3 detalles de diseño de los
dashboards auditables (arriba) — no bloquean nada.

Técnico: sin puntos abiertos — las dos dudas de arquitectura (menú del
sidebar, cabecera del token) se resolvieron revisando el código real, y se
sumó el diseño de alias de puesto de trabajo (arriba).

## Estado
Planteamiento funcional **cerrado, con visto bueno de consultoría**.
Diseño técnico cerrado (tablas, guards, módulo, endpoints, frontend), basado
en las convenciones reales del código. **En construcción desde 2026-09-15**:
- ✅ Cliente y estructura (`consulting_clients`/`consulting_client_companies`,
  CRUD + vincular/desvincular empresas, menú "Consultoría").
- ✅ `course_categories` (núcleo, no `consulting_*`) — sustituye
  `courses.category`. `catalog_courses.target_audience` (núcleo) añadido por
  el mismo motivo.
- ✅ Acciones formativas — camino "usar un curso ya existente": etiquetar
  (origen/categoría/fecha) un `catalog_courses` ya existente vía
  `consulting_action_details`. Objetivos/Horas/Modalidad/Dirigido a se leen
  del propio curso de catálogo, sin duplicar. Camino "dar de alta una acción
  nueva" (catálogo+satélite en una transacción, para externas/Marisa):
  pendiente.
- Resto del roadmap sin empezar.

## Plan por fases (borrador, sujeto a las decisiones pendientes)
1. Cierre de decisiones con consultoría.
2. Diseño técnico (modelo de datos, pantallas, permisos ADMIN/CONSULTOR/centro).
3. Cliente y estructura (empresas/centros vinculados).
4. Acciones formativas (campos + origen propio/externo).
5. Plan base y por centro.
6. Auditoría anual por centro.
7. Evaluación de acciones formativas.
8. Cuadro de formación por centro (cruce automático).
9. Evaluación de competencias + configurador de plantillas por puesto.
10. Acceso externo seguro para centros.
11. *(Fase siguiente, fuera de esta fase 1)* Panel de altas/bajas de
    participantes.

## Mejoras futuras — fase 2 (fuera de alcance, sin diseñar)
Ideas para una fase posterior a las 11 anteriores, una vez Consultoría esté
desarrollada y en uso real. No forman parte del planteamiento cerrado ni
condicionan el diseño técnico actual — se anotan aquí para no perderlas. Los
4 primeros puntos son los que consultoría marcó como objetivos de fase 2.

- **Interés de un centro en acciones del catálogo**: el centro (vía su
  acceso externo por token) marca en qué acciones del catálogo de Mecohisa
  está interesado — más ligero que una petición formal. Conceptualmente
  parecido a la bolsa de interesados que ya existe en el catálogo
  (`course_interests`, ver `docs/course-catalog.md`), pero ahí el interés es
  de una persona por un curso; aquí sería de un centro por una acción.
  Estudiar si se adapta ese mismo patrón o hace falta algo nuevo.
- **Petición de formación/alumnos desde el centro**: el centro lanza sus
  propias solicitudes de formación eligiendo un curso del catálogo y los
  trabajadores que lo realizarían. **Fuerte candidato a reutilizar**: ya
  existe `api/course-request/` ("Peticiones de centros", ver
  `docs/course-requests.md`) — un centro manda por Excel o pega a mano el
  listado de alumnos que necesita para un curso de catálogo, con estado
  ABIERTA/CERRADA; es prácticamente lo mismo que pide consultoría aquí,
  valorar extenderlo en vez de construir algo nuevo. Por decidir cuando se
  estudie: a quién llega el aviso del alta (ADMIN/CONSULTOR/otro) y qué
  circuito de aprobación sigue (¿entra directa al plan del centro, como las
  altas de acciones propias actuales, o pasa por la bandeja de revisión
  opcional ya prevista, § Decisiones cerradas?).
- **Correo a centros según filtros de los informes**: desde los dashboards
  auditables, si el auditor detecta errores, campos en blanco o necesidades
  de comunicación al aplicar un filtro, disparar un correo a los centros
  afectados directamente desde ahí. Por decidir cuando se estudie: disparo
  manual desde la pantalla de filtros (lo que pide consultoría) frente a
  automático/programado, destinatario exacto en el centro, y si comparte
  plantillas con el sistema de informes por email ya existente en la app
  (fuera de Consultoría).
- **Informe de formación / dashboard adicional** — consultoría compartió 3
  ficheros reales (analizados 2026-09-15, sin decisiones tomadas todavía —
  solo para informar el diseño de fase 2):
  - **`ESTADÍSTICAS FORMACIÓN VITALIA 2016-2025.xlsx`**: hoja `DATA` es una
    tabla plana, una fila por (año × curso × centro) — columnas `AÑO`,
    `CURSO`, `CENTRO`, `AF` (código de acción formativa FUNDAE — ya tenemos
    el equivalente en `courses.fundae_id`), `FINALIZADOS`, `APUNTADOS`, `%`
    (finalizados/apuntados), `HORAS`, `€` (valor económico), `Hs finaliz`.
    2.185 filas — es el origen de todas las tablas dinámicas del informe
    Word (por curso, por centro, por año, cruces curso×centro). Confirma
    que el modelo "una fila por acción×centro×fecha" que ya tenemos
    (`consulting_action_evaluations` + el cruce del cuadro) es el correcto
    para alimentar este tipo de informe.
  - **`INFORME DE FORMACIÓN DEL GRUPO VITALIA 2025.docx`**: el informe
    anual redactado a partir de esos datos — conclusiones + 21 tablas.
    Aporta dos métricas que **no están en nuestro diseño actual**:
    - **% de éxito** (finalizados/apuntados) por centro y por curso — ahora
      mismo el cuadro de formación solo registra quién terminó, no la tasa
      de abandono/no-presentados. Podría ser una columna más del dashboard
      "Registro de Alumnos Formados" (§ Dashboards auditables), no un
      cambio de modelo (ya tenemos `APUNTADOS` implícito en la matrícula
      real de `user_group`/`user_course`).
    - **Valor económico y crédito FUNDAE** por empresa (crédito disponible
      / dispuesto / no consumido, valor en € de la formación por curso y
      centro) — esto es un eje nuevo, de gestión de crédito FUNDAE, más
      cercano a "cuánto ha costado/vale la formación" que a auditoría de
      cumplimiento ISO. Fuera del alcance actual de Consultoría (fase 1 y
      2) tal como está definido — anotar como posible fase 3, no diseñar
      todavía.
  - **`ENCUESTAS FORMACIÓN VITALIA 2024.xlsx`**: exportación de un
    formulario de Google, una fila por respuesta — datos demográficos
    (residencia/centro, edad, sexo, titulación, categoría profesional...) +
    ~10 preguntas de satisfacción por curso, promediadas por centro en una
    tabla dinámica. Hoy se analiza a mano. Encaja con lo ya dicho en el
    planteamiento funcional: la satisfacción del alumno **no** es lo que
    evalúa Consultoría (§ Evaluación de acciones formativas evalúa utilidad
    desde el punto de vista del centro, no la encuesta del alumno) — pero
    si en el futuro se quiere automatizar esta parte, el punto de entrada
    natural sería una integración con Google Forms/Sheets, no un formulario
    propio dentro de la app.
