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
  acciones + evaluación de competencias de ese año.
- **Evaluación de acciones formativas**: acción, fecha, evaluación/motivo
  (texto libre — utilidad y cumplimiento del objetivo desde el punto de vista
  del cliente auditado, no la satisfacción del alumno), porcentaje (0-100),
  imparte (empresa/centro que imparte la acción). Evaluación progresiva
  según terminan las acciones, no un único corte anual; `<50%` exige motivos
  y medidas propuestas.
- **Cuadro de formación por centro**: cruce trabajador (DNI, nombre,
  apellidos, cargo) × acción, con fecha. Automático para formación propia ya
  registrada; ajuste manual del roster evaluado (añadir/quitar trabajador)
  sin tocar la asociación real centro–trabajador. Panel de altas/bajas de
  participantes más completo: **fase siguiente**, no esta fase 1.
- **Evaluación de competencias**: 25 competencias fijas por trabajador,
  escala `1` (no necesita mejorar) / `0` (necesita mejorar) / en blanco (no
  aplica al puesto). Periodicidad libre; hábito anual en diciembre salvo
  altas o cambios de puesto. Alcance por ejercicio: plantilla activa + bajas
  dentro de ese ejercicio. Plantillas por puesto de trabajo (28 puestos)
  autorellenan la evaluación, editable; configurador administrado por ADMIN
  y CONSULTOR. Pantalla de evaluación (paso a paso / vista global / otra):
  sin decidir.
- **Acceso externo de centros**: URL + token por centro, permanente (no
  caduca por campaña), revocable/regenerable, alcance cerrado al propio
  centro, cambios auditados. Diseño de seguridad detallado: pendiente.

## Decisiones cerradas
- Cliente = entidad nueva en Consultoría (no se amplía el modelo core de
  empresa/centro).
- Auditoría anual = contenedor con estado por centro, creación **automática**
  (proceso programado al iniciar el ejercicio; un centro incorporado a mitad
  de año recibe la suya en el momento del alta). A partir de ahí, ADMIN y
  CONSULTOR pueden gestionarla a mano (reabrir, cerrar antes de tiempo,
  ajustar fechas) — automática al crearse, no cerrada a lo automático.
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
- Diseño de seguridad del token de acceso externo — el único punto
  genuinamente abierto; es un análisis técnico dedicado, no una decisión de
  negocio.
- Alcance exacto del panel de altas/bajas de participantes — deliberadamente
  sin definir, pertenece a una fase siguiente a esta fase 1.

## Estado
Planteamiento funcional y decisiones de diseño ya cerradas (documentadas
también como documento compartible para consultoría, con roadmap y checklist
de estado). Falta la validación formal con el compañero de consultoría y el
diseño de seguridad del token. Capa técnica (modelo de datos definitivo,
endpoints, pantallas, matriz de permisos) sin empezar — no crear código de
`api/consultoria/` a partir de este documento sin antes tener ese visto
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
