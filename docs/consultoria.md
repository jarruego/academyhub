# Consultoría (`api/consultoria`, sin implementar)

Nuevo apartado para gestionar servicios de consultoría de formación con los
centros de un cliente. Acceso solo **ADMIN** y **CONSULTOR**. Cliente piloto:
**VITALIA**. Fase 1: auditoría de la formación (plan, evaluación de acciones,
evaluación de competencias, cuadro por centro).

Read before touching `api/consultoria/`. Este doc recoge el **planteamiento
funcional**, ya debatido con el cliente; el diseño técnico (endpoints, DTOs,
migraciones, pantallas, matriz de permisos) todavía no ha empezado — ver
"Estado" más abajo.

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
  - Ya existen en `courses`: `course_name`, `hours`, `modality`, `category`
    (texto libre), `target_audience` (= "Dirigido a").
  - Nuevos: objetivos específicos, objetivos generales (el catálogo solo
    tiene un `objectives` único, no separado por acción), fecha (texto libre
    por ahora).
- **Plan de formación**: dos capas — plan base del cliente (acciones de
  catálogo, compartido por todos sus centros, sin duplicar) + formación
  propia de cada centro (propia o externa) por encima. Admite altas fuera de
  la campaña inicial, no es un bloque cerrado.
- **Auditoría anual** (nuevo, contenedor): una por centro y ejercicio, ciclo
  de vida borrador → abierta → cerrada. Agrupa el plan + evaluación de
  acciones + evaluación de competencias de ese año. Se cierra sola a los dos
  años de abrirse (red de seguridad), pero ADMIN y CONSULTOR pueden abrirla o
  cerrarla a mano en cualquier momento — el automatismo nunca bloquea la
  gestión manual.
- **Evaluación de acciones formativas**: acción, fecha, evaluación/motivo
  (texto libre — utilidad y cumplimiento del objetivo desde el punto de vista
  del cliente auditado, no la satisfacción del alumno), porcentaje (0-100),
  imparte (empresa/centro que imparte la acción). Evaluación progresiva
  según terminan las acciones, no un único corte anual; `<50%` exige motivos
  y medidas propuestas.
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
  abierta, pasa a solo lectura al cerrarla. Alcance cerrado a los datos de
  ese centro, sin exportaciones masivas ni navegación a otros centros;
  cambios auditados. Implementación exacta (hash, longitud, middleware): en
  el diseño técnico.

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
- "Evaluación/Motivo" de la evaluación de acciones: **texto libre único**,
  sin subcampos.
- Formación externa en el cuadro: solo entra si se registra como acción
  formativa (origen=externo); no se admite formación suelta sin pasar por
  el modelo de acción.
- Configurador de plantillas puesto↔competencia: ADMIN y CONSULTOR.
- Campo "Imparte" = empresa/centro de formación que imparte la acción.

## Decisiones pendientes
Ninguna decisión funcional o de seguridad queda abierta. Solo falta la
validación formal del planteamiento con el compañero de consultoría (§ Estado).

## Estado
Planteamiento funcional y decisiones de diseño **cerradas por completo**
(documentadas también como documento compartible para consultoría, con
roadmap y checklist de estado). Falta la validación formal con el compañero
de consultoría — es revisión, no debate. Capa técnica (modelo de datos
definitivo, endpoints, pantallas, matriz de permisos, implementación del
token) sin empezar — no crear código de `api/consultoria/` a partir de este
documento sin antes tener ese visto bueno.

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
