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
  añade la suya (más catálogo, o externa). Admite altas fuera de la campaña
  inicial, no es un bloque cerrado.
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
  - **Caso excepcional — formación presencial de Marisa** (personal de
    Mecohisa que a veces organiza formación presencial propia sin catalogar
    todavía): Marisa registra la acción en el plan (con fecha), el centro la
    evalúa igual que el resto, y Marisa puede registrar también a los
    asistentes — asume los pasos 1 y 3 en este caso.
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

## Decisiones pendientes
Consultoría revisó el documento y confirmó casi todo (correcciones ya
incorporadas arriba). Quedan dos puntos que reabrió/planteó expresamente:
- ¿Pueden ADMIN y CONSULTOR dar de alta formación **en nombre de un
  centro**, o debe hacerlo siempre el propio centro? (afecta al modelo de
  Plan de formación de arriba). A confirmar antes del diseño técnico.
- La formación presencial de Marisa (propia de Mecohisa, sin catalogar):
  ¿se le da la posibilidad de registrar una acción propia directamente, sin
  pasar por el alta formal en el catálogo? Sería un tercer origen además de
  "propia de catálogo" y "externa de un centro".

Fuera de eso, falta la validación formal del resto del planteamiento con el
compañero de consultoría.

## Estado
Planteamiento funcional y decisiones de diseño **cerradas casi por
completo** (documentadas también como documento compartible para
consultoría, con roadmap y checklist de estado); consultoría ya hizo una
pasada de revisión. Queda 1 punto reabierto (arriba) y la validación formal
del resto. Capa técnica (modelo de datos definitivo, endpoints, pantallas,
matriz de permisos, implementación del token) sin empezar — no crear código
de `api/consultoria/` a partir de este documento sin antes tener ese visto
bueno.

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

## Mejoras futuras (fuera de alcance, sin diseñar)
Ideas para una fase posterior a las 11 anteriores, una vez Consultoría esté
desarrollada y en uso real. No forman parte del planteamiento cerrado ni
condicionan el diseño técnico actual — se anotan aquí para no perderlas.

- **Peticiones de formación desde el centro**: el centro (vía su acceso
  externo por token, § Acceso externo de centros) lanza sus propias
  solicitudes de formación eligiendo un curso del catálogo y los
  trabajadores que lo realizarían. La app avisa del alta por notificación
  y/o correo. Por decidir cuando se estudie: a quién llega el aviso
  (ADMIN/CONSULTOR/otro), qué circuito de aprobación sigue la petición
  (¿entra directa al plan del centro, como las altas de acciones propias
  actuales, o pasa por una bandeja de revisión?) y su relación con la
  bandeja de revisión opcional ya prevista para altas de acciones
  formativas (§ Decisiones cerradas).
- **Avisos proactivos a centros por correo, con filtros**: aprovechando que
  el sistema ya tiene los datos para cotejarlo (evaluaciones registradas,
  roster de la auditoría), enviar correos a centros filtrando por
  situaciones como evaluación baja de una acción formativa, trabajadores
  pendientes de evaluar (competencias) o acciones formativas pendientes de
  evaluar. Por decidir cuando se estudie: quién dispara el envío (manual
  desde una pantalla de filtros, o automático/programado), destinatario
  exacto en el centro y si comparte plantillas con el sistema de informes
  por email ya existente en la app (fuera de Consultoría).
