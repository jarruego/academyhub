# Consultoría (`api/consultoria`, sin implementar)

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
funcional**, ya debatido con el cliente y revisado por consultoría; el diseño
técnico (endpoints, DTOs, migraciones, pantallas, matriz de permisos) todavía
no ha empezado — ver "Estado" más abajo.

## Modelo conceptual
- **Cliente** (nuevo, entidad propia de Consultoría): agrupa una o varias
  `companies` existentes y, por transitividad, sus `centers`. Hoy el modelo es
  plano (`centers.id_company`), sin nada que agrupe varias empresas bajo un
  cliente. Existe `courses.client` (enum `CourseClient`, incluye `VITALIA`)
  pero es solo una etiqueta a nivel de curso, no una entidad — no sirve como
  sustituto.
- **Acción formativa**: reutiliza/extiende el modelo de cursos
  (`catalog_courses`/`courses`) en vez de crear una tabla paralela — mismo
  patrón que los cursos provisionales de INAEM (`courses.is_provisional`).
  Campo nuevo `origen` (propio/externo); una acción externa no lleva
  edición/grupo/matrícula real ni sync a Moodle, solo los campos necesarios
  para plan/evaluación/cuadro.
  - Ya existen en `courses`: `course_name`, `hours`, `modality` (lista fija:
    Online/Presencial/Mixta), `category` (texto libre → pasa a lista fija),
    `target_audience` (= "Dirigido a").
  - Nuevos: `objetivos` — **un único campo**, sin separar específicos/
    generales (a petición de consultoría; el catálogo ya tiene un
    `objectives` único a nivel de catálogo, esto sería el equivalente por
    acción); `fecha` — **lista fija de valores**, no texto libre ni fecha
    real (p. ej. *A demanda*, *Según calendario central*, *Alta trabajador*,
    *En elaboración*, ampliable).
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
   años natural, con o sin auditoría para esos años?
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

## Decisiones pendientes
Consultoría dio el **visto bueno final** al planteamiento de negocio (§
Modelo conceptual y Decisiones cerradas). Solo quedan los 3 detalles de
diseño de los dashboards auditables (arriba) — no bloquean empezar el
diseño técnico.

## Estado
Planteamiento funcional y de negocio **cerrado, con visto bueno de
consultoría** (documentado también como documento compartible, con roadmap y
checklist de estado). Quedan 3 detalles de diseño de los dashboards
auditables (arriba), a resolver en paralelo. Capa técnica (modelo de datos
definitivo, endpoints, pantallas, matriz de permisos, implementación del
token) sin empezar — puede arrancar ya; no crear código de
`api/consultoria/` sin antes leer este documento entero.

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
- **Informe de formación / dashboard adicional**: consultoría mencionó un
  informe y unas tablas propias que usan hoy, para reflejarlos en el
  diseño — pendiente de que lo compartan (ver "Dashboards auditables").
