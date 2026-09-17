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
- **Plan de formación**: dos capas, y **propio de cada consultoría anual**
  (2026-09-16 — antes era continuo, ver Decisiones técnicas cerradas). La
  decisión última del plan es siempre del centro — Mecohisa no "planifica"
  por él, aunque en la práctica sea quien lo arranca. **Plan base**: el
  catálogo de Mecohisa pasa, en la práctica, a ser el plan de formación del
  centro (no una planificación aparte que se le añade) — es lo que permite
  que un centro tenga un plan que cumpla la norma aunque no habría
  construido uno por su cuenta; un único plan compartido por los centros que
  participan en esa consultoría, sin duplicar. Al abrir una consultoría
  nueva, su plan (base + por centro) se clona automáticamente del ejercicio
  anterior del mismo cliente como punto de partida editable — si no hay
  ejercicio anterior, arranca vacío. **Formación propia de cada centro**:
  por encima del plan base, cada centro añade la suya (más catálogo, o
  externa) — y **ADMIN/CONSULTOR pueden darla de alta en nombre de un
  centro**, no tiene que hacerlo siempre el propio centro. Admite altas
  fuera de la campaña inicial, no es un bloque cerrado.
- **Consultoría anual** (nuevo, contenedor — **nunca "auditoría"**: Mecohisa
  hace consultoría; la auditoría, si la hay, la reciben los centros/clientes
  de un tercero — ISO, SGE21...). **Una por cliente y ejercicio**, no por
  centro: es el mismo "proyecto de consultoría 2026 de VITALIA" trabajado
  centro a centro, no once consultorías sueltas. Los centros que participan
  son una simple **lista de pertenencia** (todos los del cliente al abrirla,
  por defecto; ampliable/reducible después) — no tienen ciclo de vida propio,
  ni fechas ni estado por su cuenta. Ciclo de vida único: abierta → cerrada,
  a mano por ADMIN/CONSULTOR (sin automatismo, ver Decisiones técnicas
  cerradas). Agrupa la evaluación de acciones y el cuadro de formación de
  ese año, centro a centro; más adelante, la evaluación de competencias.
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
  consultoría anual del cliente (por centro): entran los trabajadores activos entre el 1 de
  enero y el 31 de diciembre de ese año, y también quien causó baja dentro
  de ese mismo ejercicio (quien causó baja antes no entra); más el añadido
  manual por búsqueda descrito arriba. Plantillas por puesto de trabajo (28
  puestos) autorellenan la evaluación, editable; configurador administrado
  por ADMIN y CONSULTOR. **Pantalla de evaluación — cerrado 2026-09-16
  (combinación de las dos opciones, a petición del usuario):** tabla
  "vista global" por centro (roster, con resumen por trabajador) + al pulsar
  "Evaluar" se abre un modal **paso a paso** con las 25 competencias de ese
  trabajador (guardado inmediato por competencia, sin botón "Guardar"
  aparte) y navegación Anterior/Siguiente para recorrer todo el roster sin
  cerrar el modal.
- **Acceso externo de centros**: token opaco aleatorio (no JWT), hasheado en
  BD, resuelto en servidor al centro; único token por centro; revocable y
  regenerable al instante desde la ficha del centro. Atado al estado de la
  consultoría anual en la que participa (§ Consultoría anual): edita mientras
  está abierta, pasa a solo lectura al cerrarla. El centro usa este acceso para
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
- Consultoría anual = contenedor **por cliente y ejercicio** (no por centro),
  con creación **automática** en el planteamiento original (proceso
  programado al iniciar el ejercicio) y **cierre automático a los dos años**
  como red de seguridad. A partir de ahí, ADMIN y CONSULTOR pueden
  gestionarla a mano en cualquier momento (reabrir, cerrar antes de tiempo)
  — lo automático es el valor por defecto, nunca un bloqueo.
  **Implementado 2026-09-15, dos correcciones el mismo día** (ver Estado y
  Decisiones técnicas cerradas de la capa técnica):
  1. Solo el lado manual por ahora (abrir, cerrar, reabrir) — sin el cron.
  2. **El contenedor es del cliente, no del centro**: el primer intento la
     modeló por centro (`consulting_annual_audits`, una fila por centro+año,
     sin nada que las agrupara como "la consultoría 2026 de VITALIA") — un
     usuario hizo notar que la consultoría es una sola por cliente y
     ejercicio, aunque el trabajo se reparta centro a centro. Se sustituyó
     por `consulting_annual_engagements` (cliente + año) +
     `consulting_engagement_centers` (qué centros participan, simple lista
     de pertenencia sin ciclo de vida propio — todos por defecto al abrirla).
- Roster de la evaluación de competencias por ejercicio = trabajadores
  activos entre el 1 de enero y el 31 de diciembre de ese año + bajas dentro
  del ejercicio (quien causó baja antes no entra); ampliable a mano buscando
  por nombre/DNI/teléfono/email entre todos los trabajadores del sistema,
  con aviso si no constan de este centro.
- Plan base compartido por los centros que participan en cada consultoría
  anual, no duplicado. Selección de cursos hacia el plan: buscador con
  autocompletado sobre el catálogo, reutilizando el selector de curso que ya
  existe en otros flujos. Clonado automáticamente de un ejercicio a otro
  como punto de partida editable (no una acción manual).
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
- **El plan base no es todo-o-nada — 2026-09-16.** Al ser una plantilla
  compartida, tocarlo (añadir o quitar) afecta a todos los centros del
  cliente de golpe; un usuario pidió poder decidir el alcance en el momento:
  añadir "al base" (compartido) o "a cada centro" (copias individuales,
  `POST /plan-items/all-centers`); quitar "del base, manteniendo en cada
  centro" (reparte copias antes de borrar la fila base — nunca bloqueado) o
  "de todos los centros" (borrado real). El bloqueo por evaluación ya
  existente (ver más abajo) solo aplica a este segundo caso, nunca al
  primero, porque ahí nadie pierde el histórico.
- **Los selectores de "añadir al plan" no ofrecen lo ya cubierto — 2026-09-16.**
  El de "Acciones propias de este centro" (en la ficha del centro) excluye
  lo que ya está en el plan efectivo de ese centro (base o propio); el de
  "Plan base"/"a cada centro" (en la ficha del cliente) excluye lo que ya
  está en el base. Antes se podía seleccionar un duplicado y el backend lo
  rechazaba con un error — ahora ni sale en la lista.
- **"Imparte" se autorrellena con la organización cuando la acción es
  propia — 2026-09-16.** Si el `origin` de la acción (`consulting_action_details`)
  es `OWN` (de Mecohisa, dentro de la app — no añadida por el centro), quien
  imparte siempre es la organización: el campo se fuerza en el servicio
  (`ConsultingEvaluationService.resolveImparteText`, inyecta `OrganizationService`
  — `settings.company.razon_social || settings.site_name`) tanto al crear
  como al editar, ignorando lo que venga en el DTO. En el formulario el
  campo se ve ya relleno y deshabilitado para estas acciones — no hace
  falta escribirlo. Para acciones `EXTERNAL` (añadidas por el centro) sigue
  siendo texto libre, sin cambios.
- **La consultoría anual es del cliente, no del centro — corregido
  2026-09-15, segunda vuelta el mismo día.** Primer intento:
  `consulting_annual_audits` una fila por centro+año, sin nada que agrupara
  los centros de un mismo cliente/ejercicio. Un usuario hizo notar que "yo
  como consultor abro la consultoría de un año para un cliente y añado los
  centros que quiera, por defecto todos" — se sustituyó por:
  - `consulting_annual_engagements` (`id_consulting_client` + `year`, único
    por par): el contenedor real, con su propio ciclo de vida
    abierta/cerrada.
  - `consulting_engagement_centers`: qué centros participan — pertenencia
    simple (id_annual_engagement + id_center), **sin estado ni fechas
    propias**. Al abrir la consultoría se puebla con todos los centros del
    cliente salvo que se indiquen unos concretos; ampliable/reducible
    después sin tocar el contenedor.
  - Nomenclatura: nunca "auditoría" en el dominio — Mecohisa hace
    consultoría, la auditoría (si la hay) la reciben los centros/clientes de
    un tercero (ISO/SGE21/...). `ConsultingEngagementStatus` (`OPEN`/`CLOSED`),
    no `ConsultingAnnualAuditStatus`.
- **Evaluación de acciones y Cuadro viven dentro de una consultoría + centro
  concretos, nunca inferidos** — primera corrección del mismo día, previa a
  la de arriba: la versión inicial del Cuadro resolvía el año preguntando
  "¿cuál está abierta ahora?", lo que se rompe en el cambio de ejercicio
  (cerrando 2026 y abriendo 2027 a la vez, con las dos abiertas un rato). La
  navegación refleja esto: se entra explícitamente a
  `/consultoria/clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center`,
  y todo lo de dentro (Evaluación de acciones, Cuadro) queda atado a esos
  dos ids. `ConsultingClientService.getValidatedEngagementCenter(id_consulting_client,
  id_annual_engagement, id_center)` centraliza la comprobación (cliente →
  consultoría → centro participante), reutilizada por
  `ConsultingEvaluationService`, `ConsultingCuadroService` y (2026-09-16)
  `ConsultingPlanService` — el **Plan** dejó de ser la excepción: también
  vive dentro de una consultoría concreta, ver la decisión de más abajo.
- **Roster y asistentes atados a `id_annual_engagement`, no a un `year`
  suelto**: `consulting_roster_adjustments` y `consulting_action_attendees`
  referencian la consultoría (FK), único por centro+trabajador+consultoría
  (o catálogo+centro+consultoría+trabajador) — un ajuste o un asistente son
  "de esta consultoría", no "de este año" en abstracto. El roster real
  (`user_center`) sigue filtrándose por solape de fechas con el **año**
  de la consultoría (activos en cualquier momento entre el 1-ene y el
  31-dic, incluida una baja dentro de ese mismo año — baja anterior no
  entra), mismo criterio que ya estaba cerrado para el roster de
  competencias. El cruce automático (matrícula real) se acota igual, por
  `user_group.join_date` dentro de ese año.
- **Cuadro de formación — frontera automático/manual, por acción, no por origen**:
  se deriva de la matrícula real (`courses`/`groups`/`user_group`) siempre que
  el curso de catálogo tenga **al menos una edición** (`courses.id_catalog_course`)
  — nunca editable desde Consultoría, la formación gestionada por la app ya
  está validada. Si el curso de catálogo **no tiene ninguna edición** (formación
  externa, o propia de Mecohisa sin catalogar todavía — caso Marisa), se
  registra el asistente a mano (`consulting_action_attendees`). No es una regla
  por `origin` (propio/externo): una acción `OWN` sin ediciones (Marisa) cae
  igualmente en el lado manual — es la existencia de matrícula real lo que
  decide, no la etiqueta de origen.
- **Centro de la matrícula real = `user_group.id_center`, no `user_center`**:
  el centro desde el que se matriculó esa edición concreta, no el centro
  "de casa" del trabajador — evita mezclar datos si un trabajador cambia de
  centro o su matrícula viene de otro sitio. El **roster** del centro (quién
  cuenta como su plantilla, para el cuadro y para competencias más adelante)
  sí usa `user_center` como base real, con `consulting_roster_adjustments`
  encima para los casos que no cuadran.
- **Búsqueda de trabajadores = `GET /user/lookup`, sin endpoint nuevo**: ya
  filtra por nombre/DNI y devuelve teléfono/email para desambiguar en
  pantalla — se reutiliza tal cual desde el cliente (filtro adicional en el
  propio `<Select>`), sin construir un buscador nuevo en Consultoría.
- **Evaluación de acciones exige que la acción ya esté en el plan del centro**
  (base o propia — `ConsultingPlanItemRepository.existsForCenter`), y que la
  fecha de la evaluación caiga en el año de la consultoría dentro de la que
  se hace (`id_annual_engagement` viene de la URL, nunca inferido). No hay
  campo separado de "acción correctiva" para el
  caso `<50%` del planteamiento funcional — se apoya en el mismo
  `evaluation_text` (obligatorio en ese caso), sin inventar un campo nuevo
  que el planteamiento funcional no llegó a cerrar.
- **Plan propio de cada consultoría anual, no continuo — corregido
  2026-09-16.** Decisión inicial (ya revertida): una sola lista de acciones
  por cliente (`consulting_plan_items`), sin columna de año, compartida por
  todos los ejercicios. Un usuario hizo notar que el plan puede variar de un
  ejercicio a otro, tanto a nivel de plan base del cliente como de cada
  centro — no tiene sentido que abrir la consultoría de 2027 herede en vivo
  cualquier cambio hecho después en el plan de 2026. Se añadió
  `id_annual_engagement` (NOT NULL, FK) a `consulting_plan_items`; el plan
  queda scoped exactamente igual que Evaluación de acciones y Cuadro
  (`.../annual-engagements/:id_annual_engagement/plan-items...`), con su
  propio `ConsultingPlanController`/`ConsultingPlanService` (antes vivía
  dentro de `ConsultingClientController`/`.service`, se extrajo siguiendo el
  mismo patrón que Evaluación/Cuadro). Al abrir una consultoría nueva,
  `ConsultingClientService.openAnnualEngagement` clona el plan del
  ejercicio anterior más reciente del mismo cliente
  (`ConsultingPlanItemRepository.clonePlan`) — copia el plan base entero y
  solo los ítems propios de los centros que participan en la consultoría
  nueva (no los de un centro que se haya quedado fuera); si no hay ejercicio
  anterior, arranca vacío. La UI se movió con el dato: la pestaña "Plan" ya
  no está en la ficha del cliente ni existe la pantalla standalone del
  centro (`consulting-center-plan.route.tsx`, eliminada) — ahora vive dentro
  de la consultoría (`consulting-engagement.route.tsx`, pestaña "Plan" =
  plan base) y dentro del centro-dentro-de-consultoría
  (`consulting-engagement-center.route.tsx`, pestaña "Plan" = base heredado
  de solo lectura + acciones propias), junto a Evaluación y Cuadro. "Todos
  los centros" para el añadir/quitar en bloque del plan base pasó de "todos
  los centros del cliente" (`getClientCenters`) a "los centros que
  participan en esta consultoría" (`consulting_engagement_centers`), más
  correcto ahora que hay un plan por ejercicio.
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
- **Acceso externo del centro — sin `auth_user` real (corregido 2026-09-17,
  revierte la idea de "usuario técnico" de este mismo apartado).** Se planteó
  al principio una fila propia en `auth_users` por centro (`is_service_account`)
  para que `request['user']` señalara a un usuario real. Al implementarlo se
  vio innecesario: los `*_by` de negocio (`created_by`/`evaluated_by`...) ya
  estaban pensados como nullable específicamente para "lo creó el token del
  centro" (no un miembro de Mecohisa) — no iban a usar el id de ese usuario
  técnico de todos modos. `ConsultingTokenGuard` rellena `request['user']`
  con una identidad sintética (`{ id: null, username: 'centro:<id_center>' }`)
  solo para que el `AuditInterceptor` existente registre algo — sin fila
  nueva, sin contraseña inventada, sin nada que distinguir en Gestión de
  usuarios.
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
| `consulting_annual_engagements` | **Ya implementada** (2026-09-15, reemplaza `consulting_annual_audits` — ver Decisiones técnicas cerradas). El contenedor real: `id_annual_engagement`, `id_consulting_client`, `year`, `status` (`OPEN`/`CLOSED`), `opened_at`, `closed_at` (null si está abierta), `created_by` (nullable). Único por (`id_consulting_client`, `year`) — una consultoría por cliente y ejercicio. |
| `consulting_engagement_centers` | **Ya implementada** (2026-09-15). Qué centros participan en una consultoría — pertenencia simple, sin estado ni fechas propias: `id_engagement_center`, `id_annual_engagement`, `id_center`. Único por par. Poblada con todos los centros del cliente al abrir la consultoría, salvo que se indiquen unos concretos. |
| `consulting_plan_items` | **Ya implementada** (2026-09-15, `id_annual_engagement` añadido 2026-09-16 — ver Decisiones técnicas cerradas). `id_plan_item`, `id_consulting_client`, `id_annual_engagement` (NOT NULL, FK — de qué consultoría es este ítem, nunca continuo entre ejercicios), `id_center` (nullable — NULL = plan base compartido por los centros de esa consultoría), `id_catalog_course` (el plan lista acciones formativas, que son de catálogo — solo admite cursos ya presentes en `consulting_action_details`, validado en el servicio), `added_by` (nullable — null si lo añadió el token de acceso externo del centro), `added_at`. |
| `consulting_action_evaluations` | **Ya implementada** (2026-09-15). `id_action_evaluation`, `id_catalog_course`, `id_center`, `id_annual_engagement` (explícito — la consultoría dentro de la que se hizo, nunca inferida; la fecha debe caer en su año), `evaluation_date`, `evaluation_text` (obligatorio en el servicio si `percentage < 50`), `percentage` (0-100, nullable), `imparte_text`, `evaluated_by` (nullable), `createdAt`/`updatedAt`. |
| `consulting_roster_adjustments` | **Ya implementada** (2026-09-15). Ajuste manual del cuadro/competencias: `id_roster_adjustment`, `id_center`, `id_user`, `id_annual_engagement` (FK — de qué consultoría es este ajuste), `adjustment_type` (`ADD`/`REMOVE`), `created_by` (nullable), `createdAt`/`updatedAt`. Único por (`id_center`, `id_user`, `id_annual_engagement`). Roster efectivo del año de una consultoría = `user_center` real activo ese año ∪ `ADD` de esa consultoría − `REMOVE` de esa consultoría. |
| `consulting_action_attendees` | **Ya implementada** (2026-09-15). Registro manual de asistente, solo para acciones **sin ninguna edición real**: `id_action_attendee`, `id_catalog_course`, `id_center`, `id_annual_engagement` (FK), `id_user`, `attended_at` (date, debe caer en el año de esa consultoría), `created_by` (nullable), `createdAt`/`updatedAt`. Único por (`id_catalog_course`, `id_center`, `id_annual_engagement`, `id_user`). |
| `consulting_competencies` | **Ya implementada** (2026-09-16). Catálogo de las 25 competencias, sin dato real todavía (ADMIN las da de alta, mismo patrón que categorías/fechas): `id_competency`, `name`, `display_order`. Sin `active` ni timestamps — a diferencia de categorías/fechas, es un catálogo fijo que no necesita soft-disable. |
| `consulting_job_positions` | **Ya implementada** (2026-09-16). Catálogo de los 28 puestos: `id_job_position`, `name`, `id_job_position_group` (FK a `consulting_job_position_groups`, nullable — agrupación visual en el selector; era texto libre `group_label` hasta la segunda mitad del día, ver Decisiones técnicas cerradas), `display_order`. |
| `consulting_job_position_groups` | **Ya implementada** (2026-09-16, corrigiendo `group_label` texto libre). Grupos de puestos de trabajo, entidad propia: `id_job_position_group`, `name` (único), `display_order`. Sin más efecto en la app que agrupar visualmente el catálogo de puestos. |
| `consulting_job_position_aliases` | **Ya implementada** (2026-09-16). `id_job_position_alias`, `job_position` (texto, tal cual aparece en `user.job_position`, único), `id_job_position` (FK). Mantenida solo por ADMIN — pantalla "Puestos de trabajo" (pestaña "Pendientes de relacionar") lista los valores de `job_position` reales sin alias todavía. |
| `consulting_position_competency_templates` | **Ya implementada** (2026-09-16). Configurador: `id_position_competency_template`, `id_job_position` (FK), `id_competency` (FK), `default_value` (boolean nullable: true=no necesita mejorar, false=necesita mejorar, NULL=no aplica a ese puesto), único por (`id_job_position`, `id_competency`). |
| `consulting_competency_evaluations` | **Ya implementada** (2026-09-16). `id_competency_evaluation`, `id_user` (FK), `id_center` (FK), `id_competency` (FK), `id_annual_engagement` (FK, explícito), `value` (boolean nullable, misma escala que la plantilla), `evaluated_at`, `evaluated_by` (nullable). Único por (`id_user`, `id_center`, `id_competency`, `id_annual_engagement`). Solo se persiste una fila al editar esa celda — el valor "efectivo" mostrado antes de editar es el de la plantilla del puesto, calculado en el servicio, no copiado a BD hasta que se toca. |
| `consulting_center_tokens` | **Ya implementada** (2026-09-17, `token_encrypted` añadido el mismo día — ver nota abajo). `id_center` (único, PK), `token_hash` (SHA-256, autenticación), `token_encrypted` (AES-256-GCM reversible, nullable — para poder volver a mostrarlo), `created_at`, `last_used_at`, `revoked_at`. Sin FK a `auth_users` — no hay usuario técnico detrás, ver "Guards y acceso externo". |

Notas:
- `id_annual_engagement` en evaluaciones es explícito (no derivado en cada query) para que los 4 dashboards no tengan que recalcular a qué ejercicio pertenece cada fila — igual que ya hace `consulting_action_evaluations`.
- **`user.job_position` ya existe** (texto libre) — se usa como señal para el autorelleno de la plantilla por puesto, resuelto vía `consulting_job_position_aliases` (no comparando texto directamente contra `consulting_job_positions.name`, poco fiable). Si el valor de `job_position` no tiene alias todavía, no hay autorelleno (celdas en blanco) y se avisa en el modal de evaluación de ese trabajador, sin bloquear — el valor queda listado en "Puestos de trabajo" (pestaña "Pendientes de relacionar") para que ADMIN lo relacione.
- **`ConsultingCompetencyEvaluationService.getRosterWithCompetencies`** resuelve el "efectivo" de cada celda en memoria (sin N+1): evaluación ya guardada, si la hay; si no, el `default_value` de la plantilla de su puesto; si no, en blanco — expuesto en la respuesta como `source` (`evaluated`/`template`/`blank`) para que el frontend distinga lo ya tocado a mano de lo que sigue siendo sugerencia.
### Guards y acceso externo

**No hay precedente de acceso público por token en este código** (se comprobó — el único `@Public()` existente es login y descarga de ficheros; el "token" de `docs/mail-moodle.md` es un token de servidor→Moodle, no de visitante→servidor). Es infraestructura nueva — **implementada 2026-09-17** sin usuario técnico (ver "Decisiones técnicas cerradas" arriba, corrige el planteamiento inicial de esta sección):

- `ConsultingTokenGuard` (`src/guards/auth/consulting-token.guard.ts`, junto a `AuthGuard`): lee el token de `Authorization: Bearer <token>` (no de la URL de cada llamada a la API — el enlace humano sí lo lleva en la URL, pero el cliente lo reenvía por esa cabecera vía `use-consulting-centro-axios.util.ts`), lo hashea (SHA-256, determinista — `opaque-token.util.ts`), lo resuelve contra `consulting_center_tokens`, comprueba `revoked_at IS NULL`, actualiza `last_used_at` y rellena `request['user']` con una identidad sintética (`{ id: null, username: 'centro:<id_center>' }` — sin usuario técnico real, ver más arriba) solo para que el `AuditInterceptor` registre algo. El propio controlador (`ConsultingCentroService`) comprueba el estado de la consultoría en la que participa el centro por cada llamada de escritura: si está `CLOSED`, la rechaza (`ForbiddenException`) — no es el guard quien decide esto, porque depende de qué `id_annual_engagement` se esté tocando en cada endpoint, y ese dato solo lo tiene el controlador, no el guard.
- Enlace humano: `https://<app>/consultoria-centro/:token` — ruta de cliente sin el layout/sidebar normal (`ConsultingCentroShell`), montada en `main.tsx` con su propio router (`router-consulting-centro.tsx`) **antes** de `AuthProvider`, que si no bloquea cualquier URL detrás del login sin mirar la ruta.
- **Sesión ligada al navegador, no al token en sí (2026-09-17, pedido explícito del usuario).** El token identifica inequívocamente al centro y da permisos especiales — el usuario no quería que esa entrada "se quedara siempre abierta" más allá de cerrar el navegador. Como el guard es un bearer stateless (sin cookie ni JWT con expiración), la única forma de que "cerrar el navegador" signifique algo es no dejar el token en ningún sitio que sobreviva a eso. Por eso `/consultoria-centro/:token` (`ConsultingCentroEntryRoute`) es el **único** sitio donde el token vive en la URL: en cuanto se visita, se guarda en `sessionStorage` (nunca `localStorage` — eso sí sobreviviría a cerrar el navegador) y se redirige a `/consultoria-centro/app[...]`, rutas internas que ya no lo llevan en la URL ni en el historial. `ConsultingCentroShell` lee el token de `sessionStorage`; si no está (navegador cerrado y reabierto, u "Salir" en la cabecera, que lo limpia a mano) muestra "Sesión no disponible" y hay que volver a usar el enlace original — el token en sí sigue siendo válido (no es de un solo uso, ADMIN puede seguir viéndolo/copiándolo desde la ficha del centro), solo se pierde la comodidad de no tener que volver a pegarlo.
- Endpoints internos (ADMIN/CONSULTOR): `@UseGuards(RoleGuard([Role.ADMIN, Role.CONSULTOR]))` a nivel de controlador, mismo patrón que `course-request.controller.ts`. `CONSULTOR` hoy tiene los mismos privilegios que `VIEWER` (comentario en `role.enum.ts`) — Consultoría es el primer módulo que le da permisos reales.
- **Aislamiento verificado 2026-09-17** (pedido explícito del usuario: "que solo puedan leer y editar... lo que necesitan"). Capas de contención, de fuera a dentro:
  1. `ConsultingTokenGuard` solo está montado en `ConsultingCentroController` — es el único `@Public()` de la app aparte de login y ficheros (comprobado con `grep`), así que un token de centro nunca llega a ningún otro guard. Enviarlo contra cualquier ruta interna (`RoleGuard`-protegida o no) lo recibe primero el `AuthGuard` global, que intenta verificarlo como JWT y falla siempre — probado en vivo contra `GET /api/consultoria/clients`, la propia gestión ADMIN del token (`GET /api/consultoria/centers/:id/token`) y una ruta cualquiera: 401 en los tres casos, igual que sin token o con uno inventado.
  2. `id_center` sale siempre de la fila resuelta por el hash (`request['id_center']`), nunca de un parámetro/cuerpo de la petición — no hay ningún campo que un centro pueda rellenar para operar como otro.
  3. Cada endpoint de `ConsultingCentroController` valida participación (`ConsultingEngagementCenterRepository.isParticipant`) antes de nada — probado en vivo: un centro de **otro cliente** (AFAMP) recibe `[]` en "mis consultorías" y 404 al pedir el plan de la consultoría de VITALIA.
  4. Las evaluaciones comprueban además propiedad (`evaluation.id_center !== id_center` → 404) — probado en vivo entre dos centros del **mismo** cliente y la **misma** consultoría (ALCOLEA/ALCORCON): un centro no ve la evaluación del otro al listar, y editarla/borrarla por id devuelve "Evaluación no encontrada en esta consultoría", nunca el dato de quién es.
  5. `listActions` dejó de traer a memoria el plan de **todos** los centros de la consultoría para filtrar después (nunca se devolvía en la respuesta, pero violaba mínimo privilegio también a nivel de consulta) — ahora `ConsultingPlanItemRepository.findEffectiveForCenter` filtra ya en el `WHERE` (base ∪ propio de ese centro), igual que ya hacían el resto de consultas scoped a centro.
  6. Escritura bloqueada si la consultoría está `CLOSED` (`assertWritable`, en el servicio — el guard no lo sabe, depende del `id_annual_engagement` de cada llamada).
  Sin capacidad de listado masivo ni de navegar a otro centro/cliente desde ningún endpoint — el alcance sigue siendo el cerrado en el planteamiento funcional (§ Modelo conceptual): evaluar sus acciones (competencias y asistentes, pendientes).

### Módulo (NestJS), siguiendo el patrón de `course-request`

`server/src/api/consultoria/` — un controlador por área (cliente, acción/catálogo, plan, consultoría anual, evaluación de acciones, cuadro/roster, competencias, dashboards, y uno aparte para el acceso externo del centro), servicios junto a cada controlador, DTOs en `dto/`. Repositorios en `server/src/database/repository/consultoria/`. Registrado en `imports` de `server/src/api/api.module.ts` (no en `app.module.ts`).

**Ya implementados** (2026-09-15): consultoría anual y sus centros participantes viven en `ConsultingClientController`/`ConsultingClientService` (crecen ahí porque todos parten de "el cliente" — `getClientCenters`/`assertCenterBelongsToClient`/`getValidatedEngagement`/`getValidatedEngagementCenter`, públicos para que los reutilicen otros servicios): `GET/POST /clients/:id/annual-engagements`, `PATCH .../annual-engagements/:id_annual_engagement` (cerrar/reabrir), `GET/POST/DELETE .../annual-engagements/:id_annual_engagement/centers[/:id_center]`. Evaluación de acciones y Cuadro de formación viven **dentro de una consultoría + un centro concretos** (dos correcciones el mismo día, ver Decisiones técnicas cerradas): `ConsultingEvaluationController`/`.service` y `ConsultingCuadroController`/`.service` en `api/consultoria/clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center/{evaluations,roster,cuadro,attendees}`, ambos apoyados en `ConsultingClientService.getValidatedEngagementCenter` (cliente → consultoría → centro participante, sin inferir nada). Cuadro además inyecta `CourseRepository` (núcleo) para saber si un curso de catálogo tiene alguna edición real. El **Plan** se extrajo a `ConsultingPlanController`/`ConsultingPlanService` (2026-09-16, ver Decisiones técnicas cerradas — dejó de vivir en `ConsultingClientService`) en `api/consultoria/clients/:id/annual-engagements/:id_annual_engagement/plan-items[/all-centers][/:id_plan_item]`, apoyado igual en `getValidatedEngagement`/`getValidatedEngagementCenter`.

**Evaluación de competencias, construida 2026-09-16**: seis controladores nuevos (cinco al principio, más `ConsultingJobPositionGroupController` en la segunda mitad del día), siguiendo el mismo reparto por área. Catálogos `ConsultingCompetencyController` (`api/consultoria/competencies`), `ConsultingJobPositionController` (`api/consultoria/job-positions`) y `ConsultingJobPositionGroupController` (`api/consultoria/job-position-groups`, ver Decisiones técnicas cerradas), lectura `[ADMIN, CONSULTOR]`/escritura `[ADMIN]`, mismo patrón que `ConsultingPlanningDateController`. `ConsultingJobPositionAliasController` (`api/consultoria/job-position-aliases[/unmapped][/:id]`), `[ADMIN]` a nivel de controlador — primer controlador de Consultoría íntegramente ADMIN-only. `ConsultingCompetencyTemplateController` (`api/consultoria/job-positions/:id_job_position/competency-template[/:id_competency]`), `[ADMIN, CONSULTOR]`, junta el catálogo de competencias con la plantilla del puesto en el servicio (`ConsultingCompetencyTemplateService.findForJobPosition`). `ConsultingCompetencyEvaluationController` (`.../clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center/competencies[/:id_user/:id_competency]`), `[ADMIN, CONSULTOR]`, inyecta `ConsultingCuadroService` para reutilizar `getRoster` (mismo roster que Cuadro, sin duplicar la lógica de `user_center` ∪ ajustes) y resuelve el valor efectivo de cada celda en memoria — ver Modelo de datos.

Apertura/cierre automático de la consultoría anual: descartado por ahora (ver Decisiones técnicas cerradas de "Modelo conceptual") — solo gestión manual.

### Frontend

- Grupo nuevo en el sidebar, "Consultoría" (`client/src/router.tsx`) — grupo sin página propia (solo etiqueta, no `<Link>`), con "Clientes", "Acciones formativas", "Competencias" y (solo ADMIN) "Puestos de trabajo" como hijos reales; visibilidad del grupo `role?.toLowerCase() === Role.ADMIN || role?.toLowerCase() === Role.CONSULTOR`.
- **Ya implementadas**: `/consultoria` (listado de clientes) → `/consultoria/clients/:id` (ficha, pestañas Cliente/Empresas/**Consultoría** — la pestaña Plan se quitó de aquí el 2026-09-16, ver más abajo); `/consultoria/actions` (listado de acciones formativas ya etiquetadas) → `/consultoria/actions/add` y `/consultoria/actions/:id_catalog_course` (buscar/editar un curso de catálogo — datos del curso en solo lectura con enlace a su ficha, Origen/Categoría/Fecha editables; "+ Añadir" en los desplegables de Categoría/Fecha para ADMIN cuando el catálogo está vacío).
  - Pestaña **Consultoría** de la ficha del cliente (**2026-09-16**, corrigiendo el modelo por-centro del día anterior): tabla de consultorías por año (Estado, Abierta el, Cerrada el, Cerrar/Reabrir, "Entrar") + formulario para abrir una nueva (año + selector multi de centros, vacío = todos los del cliente; se clona el plan del ejercicio anterior).
  - `/consultoria/clients/:id/annual-engagements/:id_annual_engagement` — pantalla de **una consultoría concreta** (`consulting-engagement.route.tsx`), con `RouteTabs` (pestañas **Centros** / **Plan**, **2026-09-16** — antes solo mostraba centros, sin pestañas):
    - **Centros**: los que participan (añadir/quitar, sin tocar el contenedor) con un enlace **"Entrar"** por fila.
    - **Plan**: el **plan base** de esta consultoría (buscador sobre las acciones ya etiquetadas + tabla, quitar por fila) — añadir "al plan base" (compartido) o "a cada centro" (copias individuales, ver Decisiones técnicas cerradas); quitar "del base, manteniendo en cada centro" o "de todos los centros" (bloqueado si algún centro ya evaluó la acción, aviso vía `modal.error` con tiempo para leerlo, no un toast).
  - `/consultoria/clients/:id/annual-engagements/:id_annual_engagement/centers/:id_center` — pantalla de **un centro dentro de una consultoría concreta** (`consulting-engagement-center.route.tsx`), con `RouteTabs` (pestañas **Plan** / Evaluación de acciones / Cuadro, **2026-09-16** añadió Plan — antes vivía en la pantalla standalone `consulting-center-plan.route.tsx`, eliminada), todo atado a esos dos ids, nunca inferido:
    - **Plan**: plan base heredado (solo lectura, referencia — se gestiona desde la pestaña Plan de la consultoría) + acciones propias de este centro (buscador que excluye lo ya cubierto por base o propio, tabla con quitar por fila, bloqueado igual si el centro ya evaluó esa acción).
    - **Evaluación de acciones**: formulario (acción del plan efectivo del centro — base + propia —, fecha, %, texto, imparte) + tabla con editar/borrar. El servicio exige que la fecha caiga en el año de esta consultoría y texto obligatorio si `% < 50`.
    - **Cuadro**: sección "Roster del centro" (buscador sobre `GET /user/lookup`, añadir/quitar, tabla de ajustes manuales con "Deshacer", todo de esta consultoría) + sección "Cruce trabajador × acción" (tabla con origen Real/Manual; formulario para registrar un asistente a mano, con error explícito si la acción elegida sí tiene matrícula real o si la fecha no cae en el año de la consultoría).
    - **Competencias** (**2026-09-16**): vista global — tabla del roster (reutiliza el mismo roster que Cuadro) con Nombre/DNI/Puesto (con aviso "sin mapear" si `job_position` no tiene alias) y un resumen por trabajador (nº que necesitan mejorar, o nº sin necesidad de mejora sobre el total aplicable). Botón "Evaluar" abre un modal paso a paso con las 25 competencias de ese trabajador (`Segmented` de 3 estados, guardado inmediato por competencia, sin botón "Guardar" aparte) y navegación Anterior/Siguiente para recorrer todo el roster sin cerrar el modal — combina las dos opciones que se plantearon, a petición del usuario.
- `/consultoria/competencies` — **Configurador de competencias por puesto** (**2026-09-16**, `[ADMIN, CONSULTOR]`), `RouteTabs` con dos pestañas: "Plantillas por puesto" (selector de puesto de trabajo, de solo lectura — el alta/edición/borrado de puestos vive en "Puestos de trabajo", ver más abajo — → tabla de las competencias con un selector de 3 estados por fila, el valor por defecto de ese puesto) y "Competencias" (catálogo de competencias: tabla con renombrar/borrar por fila + "+ Añadir competencia" al final, `[ADMIN]`). **Reestructurado 2026-09-16** (pedido del usuario): al principio competencias y puestos se gestionaban los dos desde esta pantalla, mezclados con la vista de plantilla de un puesto concreto — se separaron: competencias se quedó aquí (siguen siendo del Configurador, tienen sentido junto a la plantilla), puestos se movió entero a su propia pantalla.
- `/consultoria/job-positions` — **Puestos de trabajo** (**2026-09-16**, `[ADMIN, CONSULTOR]` para leer, `[ADMIN]` para escribir), `RouteTabs` con tres pestañas: "Listado" (tabla de los puestos con Añadir/Editar/Borrar — antes vivía repartido dentro del Configurador de competencias, se centralizó aquí para no gestionar el mismo catálogo desde dos sitios; renombrada de "Catálogo" a "Listado" el mismo día, ver nota de Grupos abajo), "Pendientes de relacionar" (valores reales de `user.job_position` sin alias todavía, selector del puesto al que corresponden + botón "Relacionar" — antes era el contenido principal, sin pestañas, de la pantalla "Puestos sin mapear") y "Ya relacionados" (alias existentes, con el puesto como desplegable editable — cambiarlo autoguarda). El banner temporal "Automapear puestos de trabajo" vive en la pestaña "Pendientes de relacionar". Los grupos de puestos se gestionan desde un botón "Gestionar grupos" en la pestaña "Listado", que abre un `Modal` (no una pestaña propia ni pantalla completa — no son muchos grupos, ver nota abajo).
  - **Grupo del puesto — dos vueltas el mismo día (2026-09-16).** Primero se
    dejó como texto libre (`group_label`) con un `Select` de valores ya
    usados + "+ Usar" para escribir uno nuevo (mismo patrón "+ Añadir" que
    Categoría/Fecha/Competencias/Puestos), para evitar duplicados por typo
    sin construir una tabla nueva. El usuario preguntó explícitamente si los
    grupos "se pueden gestionar" (listarlos, renombrarlos, borrarlos como
    tal) — la respuesta con solo texto libre era que no, así que se
    construyó la tabla de verdad: `consulting_job_position_groups`
    (`ConsultingJobPositionGroupController`, `api/consultoria/job-position-groups`,
    mismo patrón `[ADMIN, CONSULTOR]`/`[ADMIN]` que Competencias/Puestos) y
    `consulting_job_positions.group_label` (texto) pasó a
    `id_job_position_group` (FK) — migración con backfill: los 5 valores de
    texto ya en uso (`Dirección`, `Asistencial / Terapias`, `Cuidados`,
    `Servicios`, `Administración y otros`) se insertaron como filas reales
    antes de tirar la columna vieja, sin perder el dato de ningún puesto.
    Pestaña nueva "Grupos" en `/consultoria/job-positions` (tabla con
    Añadir/Editar/Borrar), y el `Select` de grupo en el formulario de puesto
    ahora crea un grupo real (vía mutación) en vez de solo rellenar texto.
    **Tercera vuelta, mismo día**: el usuario pidió simplificar — "Catálogo"
    pasa a llamarse "Listado" y la pestaña "Grupos" se elimina; los grupos se
    gestionan desde un botón "Gestionar grupos" en la pestaña "Listado" que
    abre un `Modal` (tabla de grupos con Añadir/Editar/Borrar, igual que la
    pestaña que sustituye) en vez de una pestaña propia, porque no son muchos
    grupos y no hace falta pantalla completa. El modal de alta/edición de un
    grupo se abre anidado encima del modal de gestión (antd apila el z-index
    solo). Pestañas finales: 3 (Listado/Pendientes de relacionar/Ya
    relacionados).
- Ruta externa del centro (**implementada 2026-09-17**): `/consultoria-centro/:token` (`ConsultingCentroEntryRoute` — único sitio con el token en la URL, lo pasa a `sessionStorage` y redirige) → `/consultoria-centro/app` (`ConsultingCentroEngagementsRoute` — lista sus consultorías, con enlace "Entrar") → `/consultoria-centro/app/:id_annual_engagement` (`ConsultingCentroEvaluationsRoute` — evaluar sus acciones, mismo formulario+tabla que la pestaña interna "Evaluación de acciones", sin las acciones de ADMIN/CONSULTOR que no aplican aquí). Layout propio sin sidebar (`ConsultingCentroShell`, con botón "Salir" que limpia la sesión a mano), montado en `main.tsx` con su propio router (`router-consulting-centro.tsx`) por delante de `AuthProvider`. La sesión vive en `sessionStorage` (se pierde al cerrar el navegador — ver "Guards y acceso externo"), nunca en la URL de las rutas `/app...`.
- Empresas/Centros no tienen hoy ninguna pantalla de agrupación (son recursos planos bajo "Empresas") — Cliente no se cuelga de esas pantallas, tiene las suyas propias, referenciando empresas/centros por id.

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
- ✅ Plan base y por centro (`consulting_plan_items`), **propio de cada
  consultoría anual** (2026-09-16, ver Decisiones técnicas cerradas — antes
  era continuo, sin año): añadir/quitar acciones ya etiquetadas al plan base
  de la consultoría (compartido por los centros que participan) o al plan
  propio de uno de esos centros. Flujo en dos pantallas, no una sola con
  selector de ámbito: pestaña "Plan" de la consultoría
  (`consulting-engagement.route.tsx`) para el plan base, y pestaña "Plan" de
  cada centro dentro de esa consultoría
  (`consulting-engagement-center.route.tsx`) para sus acciones propias por
  encima del base (que ahí se ve, de solo lectura, como referencia). Sin
  validación bloqueante al **añadir** más allá de exigir que la acción ya
  esté etiquetada y que el centro participe en la consultoría. Al **abrir**
  una consultoría nueva, su plan se clona automáticamente del ejercicio
  anterior más reciente del mismo cliente
  (`ConsultingPlanItemRepository.clonePlan`, invocado desde
  `ConsultingClientService.openAnnualEngagement`) — plan base completo +
  solo los ítems propios de los centros que participan en la consultoría
  nueva; sin ejercicio anterior, arranca vacío.
  **Añadido 2026-09-16** (decisión explícita del usuario, ver Decisiones
  técnicas cerradas): al tocar el plan base, elegir entre compartido/individual:
  - Añadir: "al plan base" (compartido, `id_center` NULL, como hasta ahora)
    o "a cada centro" (`POST .../plan-items/all-centers` — copia propia por
    cada centro **que participa en esta consultoría**, `id_center` de cada
    uno; un centro que se añada después no la recibe, hay que añadírsela a
    mano).
  - Quitar un ítem del plan base: "quitar del base, mantener en cada centro"
    (reparte una copia propia a cada centro participante que no la tuviera
    ya, y solo borra la fila base — nunca bloqueado, nadie pierde nada) o
    "quitar de todos los centros" (borrado real, sí bloqueado si algún
    centro ya la evaluó).
  - **Bloqueo real al quitar del todo** (no solo aviso): si algún centro
    afectado (todos los participantes, si es del base; solo ese, si es
    propia) ya evaluó la acción, el backend rechaza el borrado con un
    mensaje que dice qué centro(s) y en qué año — se perdería el histórico
    de evaluación. Aplica igual a una acción propia de un centro. El aviso
    se muestra en un `modal.error` (no un toast que desaparece solo), con
    tiempo de sobra para leerlo.
- ✅ Consultoría anual (`consulting_annual_engagements` +
  `consulting_engagement_centers`) — **solo gestión manual** (decisión
  explícita): abrir (año + centros, por defecto todos los del cliente),
  cerrar, reabrir; añadir/quitar centros participantes sin tocar el
  contenedor. Sin apertura automática de año nuevo, sin cierre automático a
  los 2 años — se añadirá cuando la consultoría agrupe algo más
  (competencias), no antes. **Dos correcciones el mismo día 2026-09-15/16**
  (ver Decisiones técnicas cerradas de la capa técnica):
  1. Evaluación de acciones y Cuadro pasaron a vivir dentro de una
     consultoría **concreta** (`id_annual_engagement` explícito en la URL y
     en cada endpoint), no de "la que esté abierta" — un usuario hizo notar
     que dos ejercicios pueden estar abiertos a la vez durante el cambio de
     año (cerrando 2026, abriendo 2027), momento en el que "la abierta" deja
     de tener una sola respuesta.
  2. El contenedor pasó de ser **por centro** (`consulting_annual_audits`,
     una fila por centro+año) a ser **por cliente** (`consulting_annual_engagements`,
     cliente+año) con los centros como simple lista de pertenencia — un
     usuario hizo notar que él abre una consultoría de un cliente y decide
     qué centros incluir, no una auditoría suelta por cada centro.
- ✅ Evaluación de acciones formativas (`consulting_action_evaluations`):
  formulario + tabla (editar/borrar) en la pestaña "Evaluación de acciones"
  de la pantalla de centro-dentro-de-consultoría. Solo evalúa acciones ya
  presentes en el plan efectivo del centro (base o propia); `id_annual_engagement`
  viene de la URL (nunca inferido), y la fecha debe caer en su año.
  `evaluation_text` obligatorio (en el servicio, no en el DTO) si
  `percentage < 50`. Sin "acción correctiva" como campo aparte — de momento
  se apoya en el mismo texto libre, ver Decisiones técnicas cerradas.
- ✅ Cuadro de formación por centro (`consulting_roster_adjustments` +
  `consulting_action_attendees`) — **las 3 piezas del planteamiento
  funcional**, no solo el cruce automático: (1) cruce automático,
  **siempre de solo lectura**, para cursos de catálogo con al menos una
  edición real (matrícula ya validada, no se toca desde Consultoría); (2)
  roster ajustable por centro y consultoría (`user_center` real ∪ `ADD` −
  `REMOVE`, reutilizado por competencias más adelante); (3) registro manual
  de asistentes (`consulting_action_attendees`) para cursos de catálogo
  **sin ninguna edición real** — externos, o propios sin catalogar (caso
  Marisa). La frontera es "¿tiene edición?", no "¿es propio o externo?" —
  ver Decisiones técnicas cerradas. Búsqueda de trabajadores reutiliza
  `GET /user/lookup`, sin backend nuevo.
- ✅ Evaluación de competencias (2026-09-16) — 5 tablas nuevas
  (`consulting_competencies`, `consulting_job_positions`,
  `consulting_job_position_aliases`, `consulting_position_competency_templates`,
  `consulting_competency_evaluations`) y 5 controladores. Catálogos de
  competencias/puestos **sin datos reales todavía** (nacen vacíos, como
  categorías/fechas en su día — ADMIN los da de alta desde el propio
  Configurador cuando consultoría facilite las 25/28 listas reales; no se
  ha sembrado nada en producción, solo en desarrollo para probar el
  flujo). Configurador puesto↔competencia (`/consultoria/competencies`,
  `[ADMIN, CONSULTOR]`) fija el valor de partida de cada competencia por
  puesto. Alias de puesto (`/consultoria/job-positions`, pestaña "Pendientes
  de relacionar", `[ADMIN]`) resuelve `user.job_position` (texto libre)
  contra el catálogo. Evaluación
  real en la pestaña "Competencias" de centro-dentro-de-consultoría:
  reutiliza el roster de Cuadro, vista global (tabla + resumen) más un
  modal paso a paso por trabajador con navegación Anterior/Siguiente —
  combinación de las dos opciones de pantalla que se habían planteado, a
  petición del usuario. El valor de una celda no evaluada a mano se
  calcula en el momento desde la plantilla del puesto (nunca se persiste
  hasta que se edita). **Catálogo de competencias en pestaña propia**
  (2026-09-16, corrección de UX pedida por el usuario): al principio crear/
  renombrar/borrar una competencia vivía dentro de la vista de un puesto
  concreto (confuso — una competencia es global, compartida por todas las
  plantillas), se separó en una pestaña "Competencias" propia dentro de
  `/consultoria/competencies` (`RouteTabs`: "Plantillas por puesto" /
  "Competencias"). Como tocar una competencia afecta a la plantilla de
  **todos** los puestos de golpe, esas tres acciones piden reconfirmar la
  contraseña del usuario antes de ejecutarse (`ConfirmPasswordModal` +
  `POST /auth/verify-password`, ya existente en la app — mismo mecanismo
  que la importación de Preinscritos INAEM — sin guard ni endpoint nuevo).
  Renombrar/borrar un **puesto** de trabajo no lo pide (no afecta a otros
  puestos), sigue con confirmación simple junto al selector.
- **[Temporal] Autorrelleno de catálogo y automapeo de puestos — pedido
  explícito del usuario 2026-09-16**, para no escribir a mano ni en
  desarrollo ni en producción las 25 competencias / 28 puestos ni su
  plantilla, ni mapear a mano los ~250 valores reales de `user.job_position`.
  Datos en `server/src/api/consultoria/consultoria-catalog-seed.data.ts`:
  `DRAFT_COMPETENCIES` (25), `DRAFT_JOB_POSITIONS` (28) y
  `POSITION_COMPETENCY_TEMPLATE` (qué competencias aplican a cada puesto)
  son **reales**, sacados del `cuadro competencias.xlsx` que dio el usuario
  2026-09-16 (ya no un borrador ni una lista heurística) — el Excel marca
  "aplica" con un 1 por celda, sin juicio de valor; al importarlo esa celda
  se traduce como `default_value: true` ("no necesita mejorar" de partida),
  convención mía razonable, no algo que diga el Excel. `JOB_POSITION_MAPPING_RULES`
  (qué palabra clave de `user.job_position` corresponde a qué puesto real)
  sigue siendo mío, sin verificar — y desde que los puestos pasaron a ser
  los 28 reales del Excel (más específicos que mi agrupación heurística
  anterior — p. ej. ya no existen "Portero/a", "Jardinero/a", "Vigilante"
  como puestos, y sí se distingue "Rble. de Enfermería" de "Enfermero/a"),
  las reglas se reescribieron para esa taxonomía nueva; valores como
  "AUX ENFER" se enrutan a Gerocultor/a antes que a Enfermero/a (auxiliar ≠
  enfermero/a titulado), y "TASOC" a Monitores/as, no a Trabajo Social —
  el propio Excel los separa. **Segunda pasada 2026-09-16** (pedida por el
  usuario — "aplica un poco de investigación y sentido común"): revisados a
  mano los ~130 valores que quedaban sin mapear tras la primera pasada.
  Bajó a 212 alias creados (antes 131) y 52 sin mapear (antes 132) — la
  mayoría de los abreviados eran solo eso, abreviados de más (p. ej.
  `OF.ADMINIS`→Administración, `TERAPUT.OC`→Terapeuta Ocupacional,
  `TRAB.SOC`→Trabajo Social, truncados por debajo de lo que cazaban los
  fragmentos anteriores). Lo que sigue sin mapear son categorías realmente
  genéricas sin puesto específico al que asignarlas (`TIT. SUPER` =
  "Titulado Superior", sin decir de qué), la familia "Ayudante de Oficios
  Varios" (ese puesto no existe en la lista real de 28), o valores que
  parecen error de captura (`9901082501`, `Sin catego`, `RETRIBUC.`,
  `Desde NLWG`) — mejor dejarlos así que inventar un mapeo.
  **Tercera pasada 2026-09-16, corregida por el usuario en la cuarta**: en
  la tercera intenté distinguir "Ayudante de Oficina" (→ Administración) de
  "Ayudante de Oficios Varios" dentro de la familia "AY(TE/D)... OF...",
  dejando solo `AY.OFICIOS` sin mapear por deletrear la palabra completa. El
  usuario corrigió: en esta empresa **toda** esa familia es realmente
  "Ayudante de Oficios Varios" — y se vincula con **Gerocultor/a**, no con
  Administración (ese puesto no existe suelto en la lista de 28, y la
  empresa los trata como parte del equipo de Gerocultor/a). Regla de
  desambiguación del usuario: dentro de los valores que empiezan por
  "AY(TE/D/UDANTE)", solo van a Administración los que llevan la palabra
  "ADM" en algún sitio (p. ej. un futuro "AYTE.ADM") — el resto, incluido
  `AY.OFICIOS`, a Gerocultor/a. 227 alias en total, 37 sin mapear.
  `ConsultingCatalogSeedController`
  (`api/consultoria/catalog-seed/fill` y `/automap-job-positions`),
  `[ADMIN]`, botones "Autorrellenar catálogo" (pestaña Competencias) y
  "Automapear puestos de trabajo" (Puestos de trabajo → Pendientes de
  relacionar); mismo automapeo
  disponible como script standalone (`server/seed-consulting-job-catalog.ts`,
  `npx ts-node -r tsconfig-paths/register seed-consulting-job-catalog.ts`),
  comparten datos para no desincronizarse. `fillCatalog` es idempotente en
  las tres capas (competencia/puesto ya existente por nombre, o celda de
  plantilla ya guardada, no se tocan). Automapeo de alias conservador: solo
  crea uno cuando una palabra clave encaja, lo demás queda en "Puestos sin
  mapear" para revisar a mano — y ahí, en la tabla "Ya mapeados", el puesto
  asignado es ahora un desplegable editable (no solo un botón de quitar):
  cambiarlo reutiliza el mismo `upsert` (autoguardado, refresca las dos
  tablas al momento). **Marcado explícitamente como temporal** —
  borrar controlador/servicio/datos/botones/script cuando el usuario avise
  de que ya no hace falta.
- ✅ Acceso externo del centro por token (fase 10 del roadmap, completa,
  2026-09-17) — infraestructura + las tres capacidades del alcance cerrado
  (evaluar sus acciones, evaluar competencias, registrar asistentes de sus
  propias acciones). Nuevo `ConsultingTokenGuard` (token opaco
  aleatorio, hasheado con SHA-256 — no scrypt/salt por fila como
  `password-hashing.util.ts`, porque aquí el hash tiene que ser determinista
  para buscar por igualdad en BD; con 256 bits de entropía un hash rápido ya
  es indistinguible de fuerza bruta — ver `opaque-token.util.ts`), montado
  solo en `ConsultingCentroController` (`@Public()` + `@UseGuards(...)`,
  `api/consultoria/centro/*`) — nunca en las rutas internas, sin ambigüedad
  con el JWT normal. `consulting_center_tokens` (`id_center` único,
  `token_hash`, `created_at`, `last_used_at`, `revoked_at`) — un único token
  por centro, regenerarlo sustituye el hash anterior (invalida el enlace
  viejo al momento). Gestión ADMIN-only (`ConsultingCenterTokenController`,
  `api/consultoria/centers/:id_center/token`) desde la pestaña "Consultoría"
  **de la ficha del centro** (`/centers/:id/edit`, pantalla núcleo, no de
  Consultoría — ahí es donde consultoría pidió poder revocarlo/regenerarlo).
  **Token único y exclusivamente para centros dentro de una consultoría
  abierta, salvo que se haya revocado — corregido 2026-09-17 el mismo día**
  (primero se implementó "todo centro tiene token por defecto", pedido
  explícito del usuario; el propio usuario aclaró después que era demasiado
  amplio: la mayoría de centros de la app no tienen nada que ver con
  Consultoría, así que el token — y la pestaña entera — debe limitarse a
  los que participan en alguna consultoría anual `OPEN`).
  `ConsultingCenterTokenService.getStatus`/`.issue` comprueban participación
  en una consultoría `OPEN` (`ConsultingEngagementCenterRepository.findByCenterId`)
  antes de generar nada — tanto en el alta automática (primera consulta de
  la pestaña) como en el alta manual ("Regenerar"); ninguno de los dos
  genera un token para un centro fuera de una consultoría abierta
  (`BadRequestException`, probado contra la API). Nunca si ya existe una
  fila, revocada o no, así que revocar sigue siendo definitivo hasta que
  ADMIN pulse "Regenerar" a mano; sin botón "Generar" en el frontend, ya no
  hace falta (solo "Regenerar"/"Revocar"). La pestaña "Consultoría" de
  `center-detail.route.tsx` **ni se muestra** para un centro sin token
  (`consultingTokenStatus?.exists` decide si se incluye en `RouteTabs`) — no
  solo el token, la pestaña entera queda fuera para el resto de centros.
  Cubre los centros nuevos solos, sin enganchar este módulo a la creación
  de centros (núcleo) — y para los que ya existían al construir esto, un
  backfill puntual (`seed-consulting-center-tokens.ts`, idempotente, solo
  los que participan en una consultoría `OPEN` y no tenían fila) les generó
  el suyo de una vez; los 14 tokens que se habían creado de más en la
  primera pasada (centros fuera de cualquier consultoría abierta) se
  borraron a mano — no queda ninguna fila para ellos, ni falta.
  **Dos vueltas el mismo día sobre "cuándo se puede ver el token":**
  primero, siguiendo el patrón de un API key (GitHub/Stripe), solo se
  devolvía en claro una vez al generarlo, sin guardarlo en ningún sitio
  recuperable (solo el hash) — el usuario preguntó por qué no dejarlo
  siempre disponible para copiar, ya que solo ADMIN entra a esa pantalla.
  Se corrigió a un intermedio (mantenerlo en memoria de React durante la
  visita, perdiéndolo al recargar), y el usuario pidió ir más allá:
  siempre disponible, sin depender de la sesión del navegador. Se añadió
  `token_encrypted` (AES-256-GCM vía `APP_MASTER_KEY`, reversible — mismo
  mecanismo que la contraseña SMTP de organización) junto al `token_hash`
  que sigue usando el guard para autenticar; `getStatus` ahora también
  descifra y devuelve el token, así que la pestaña lo muestra siempre, sin
  modal ni aviso de "una sola vez". Contrapartida asumida a propósito: quien
  tenga acceso a la BD *y* a `APP_MASTER_KEY` puede recuperar todos los
  tokens de golpe (mismo riesgo que ya se acepta hoy para la contraseña
  SMTP) — a cambio de no tener que regenerar el enlace de un centro cada
  vez que ADMIN necesita volver a compartirlo. En pantalla el enlace se
  muestra oculto por defecto (`Input.Password`, mismo componente que un
  campo de contraseña — puntos + icono de ojo para revelarlo si se quiere)
  con un botón "Copiar" aparte que funciona sin necesidad de revelarlo
  antes — pedido explícito del usuario tras la corrección anterior: que sea
  copiable siempre no significa que tenga que estar a la vista por defecto.
  Enlace humano
  `/consultoria-centro/:token`: layout propio sin sidebar ni login normal —
  montado en `main.tsx` **antes** de `AuthProvider` (que si no, bloquea
  cualquier ruta detrás de la pantalla de login sin mirar la URL), con su
  propio router (`router-consulting-centro.tsx`), su propio contexto de
  autenticación (`consulting-centro.context.tsx`, el token vive en la URL,
  no en `localStorage`) y su propia variante del hook de axios autenticado
  (`use-consulting-centro-axios.util.ts`). Alcance cerrado **completo desde
  2026-09-17**: listar "sus" consultorías (centro ∈
  `consulting_engagement_centers`), evaluar sus acciones, evaluar
  competencias y registrar asistentes de sus propias acciones — las tres
  últimas todas con el mismo patrón (`ConsultingCentroService` delegando en
  el servicio interno que ya usan ADMIN/CONSULTOR — `ConsultingEvaluationService`,
  `ConsultingCompetencyEvaluationService`, `ConsultingCuadroService` — sin
  duplicar reglas de validación, solo resolviendo la consultoría a partir
  del centro del token y bloqueando la escritura si está `CLOSED`).
  Pantallas del centro (`ConsultingCentroEngagementRoute`, 3 pestañas:
  Evaluación de acciones / Competencias / Asistentes) deliberadamente
  simples — reutilizan la misma lógica que las pantallas internas de
  ADMIN/CONSULTOR sin intentar hacerlas más amigables todavía; si en el
  futuro conviene una versión distinta para los centros, se revisará
  cuando todo esté funcionando y en uso real, no antes.
  **Sin roster ajustable ni búsqueda de todos los usuarios del sistema**
  para el centro: para elegir a quién evaluar o registrar como asistente
  usa su propio roster (`GET .../roster`, ya scoped a `id_center` — mismos
  datos que ya ve en Competencias), nunca `GET /user/lookup` (todo el
  sistema, solo ADMIN/CONSULTOR) — decisión deliberada de mínimo privilegio
  (ver "Aislamiento verificado" arriba), no una limitación técnica: cubre el
  caso normal (registrar a los suyos) sin abrir una búsqueda de toda la
  plantilla de la app a un token externo. `getCuadro` tenía el mismo
  sobre-consumo que `listActions` (traía a memoria el plan de todos los
  centros antes de filtrar) — corregido a la vez, usando
  `findEffectiveForCenter` también aquí.

## Plan por fases (borrador, sujeto a las decisiones pendientes)
1. Cierre de decisiones con consultoría.
2. Diseño técnico (modelo de datos, pantallas, permisos ADMIN/CONSULTOR/centro).
3. Cliente y estructura (empresas/centros vinculados).
4. Acciones formativas (campos + origen propio/externo).
5. Plan base y por centro.
6. Consultoría anual (cliente + centros participantes).
7. Evaluación de acciones formativas.
8. Cuadro de formación por centro (cruce automático).
9. Evaluación de competencias + configurador de plantillas por puesto.
10. Acceso externo seguro para centros — **completo 2026-09-17** (infraestructura + evaluación de acciones + evaluación de competencias + registro de asistentes de sus propias acciones, ver "Estado").
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
