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
- Auditoría anual = contenedor con estado por centro.
- Plan base compartido por todos los centros del cliente, no duplicado.
- Acciones formativas reutilizan el modelo de cursos existente, con flag de
  origen (propio/externo).
- Configurador de plantillas puesto↔competencia: ADMIN y CONSULTOR.
- Campo "Imparte" = empresa/centro de formación que imparte la acción.

## Decisiones pendientes
- Listado definitivo de campos de la acción formativa (¿Modalidad/Categoría
  pasan de texto libre a lista fija?).
- Mecanismo de selección de cursos del catálogo hacia el plan base;
  validación de altas de un centro; si el plan es clonable de un año a otro.
- Creación automática vs. manual de la auditoría anual por centro; qué pasa
  con un centro incorporado a mitad de año.
- Si "Evaluación/Motivo" necesita subcampos (impacto / motivo de anulación /
  medidas si `<50%`) o queda como texto libre único.
- Circuito para que la formación externa entre en el cruce del cuadro por
  centro; alcance exacto del panel de altas/bajas (fase siguiente).
- Diseño de seguridad del token de acceso externo — análisis dedicado.

## Estado
Planteamiento funcional cerrado con el cliente, documentado también como
documento compartible para consultoría (con roadmap y checklist de estado).
Capa técnica (modelo de datos definitivo, endpoints, pantallas, matriz de
permisos) sin empezar — no crear código de `api/consultoria/` a partir de
este documento sin antes cerrar las decisiones pendientes de arriba.

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
