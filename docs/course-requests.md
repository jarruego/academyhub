# Peticiones de centros

**Leer antes de tocar `api/course-request/`.**

Gestor de peticiones de formación que envían los centros/clientes (normalmente centros privados pidiendo cursos FUNDAE). Un centro manda por Excel (o se pega a mano) el listado de alumnos que necesitan una formación concreta; se guarda como una "petición" con su centro, curso y correo de contacto, editable como una hoja de cálculo.

## Alcance de esta fase

Solo alta/gestión de la petición en sí (cabecera + filas de alumnos). **No** se toca `users` ni se genera matrícula: los datos de alumnos son texto en bruto. La matriculación desde estas peticiones (varias peticiones de distintos centros pudiendo aportar alumnos a un mismo grupo) se hará más adelante desde la pantalla de grupos; por eso una petición se puede cerrar manualmente ya, o (en el futuro) al usarse para matricular.

## Modelo de datos

- `course_requests` (cabecera): `id_center` (nullable — normal que exista, pero no se bloquea si falta), `id_course` (obligatorio), `request_date` (fecha `date`, `NOT NULL DEFAULT now()` — fecha de la petición; por defecto la de alta, editable a mano desde el cliente, p. ej. si se sube tarde una petición ya recibida antes), `contact_email` (nullable, para futuros informes de seguimiento), `is_urgent` (boolean, `NOT NULL DEFAULT false` — marca puramente visual, no afecta a ningún flujo), `status` (`ABIERTA`/`CERRADA`), `source` (`EXCEL`/`MANUAL`, según el último alta de alumnos), `notes`, `created_by`, `closed_at`. Índices por `id_course`, `id_center`, `status`.
- `course_request_students` (filas, ON DELETE CASCADE desde la cabecera): `name`, `first_surname`, `dni`, `email` (**NOT NULL**, pero admiten `''` — ver parser), `second_surname`, `phone_mobile` (opcionales). `row_order` para el orden de la grid.

Nombre, apellido 1, DNI y correo son "obligatorios" **solo como indicación visual** (asterisco en la cabecera de columna + rojo en la grid si faltan/son inválidos), pero **no bloquean el guardado**: `CourseRequestStudentDto` no exige ninguno de los campos (`@IsOptional()` en todos), y `saveStudents` (`PUT :id/students`) rellena con `''`/`null` lo que falte antes de persistir. Se decidió así a propósito: el objetivo de esta pantalla es guardar bien la petición tal cual llega, aunque esté incompleta, y corregirla después — nunca perder la subida por un dato mal escrito. La subida de Excel (`POST :id/upload`) igual: inserta lo que reconozca, posiblemente vacío.

## Saneo de campos (`course-request-normalize.util.ts`)

Igual que SAGE/INAEM pero **sin descartar** valores inválidos (esto es contenido editable, no un matching automático): `normalizeText` (trim + colapsa espacios), `normalizeDni` (mayúsculas, sin espacios/guiones/puntos), `normalizeEmail` (trim + minúsculas; reutiliza `sanitizeEmail` de `src/utils/email.util.ts` cuando el resultado es válido), `normalizePhone` (quita separadores, conserva un `+` inicial). Se aplica en dos puntos:
- **Excel** (`course-request-excel.parser.ts`): a cada celda reconocida, antes de meterla en `rows`.
- **Guardado desde la grid** (`CourseRequestStudentDto`, `PUT :id/students`): vía `@Transform` de class-transformer, que corre **antes** de `class-validator` (así el valor ya llega saneado al servicio, independientemente de que sea válido o no).

El cliente duplica una versión ligera de estos saneadores en `course-request-students-grid.tsx` (aplicados al pegar un bloque y al perder el foco de una celda, `onBlur`) para que la grid se vea limpia antes de guardar; el saneo real y autoritativo es el del servidor.

## Validación visual en la grid (`course-request-students-grid.tsx`)

Cada celda de alumno se pone en rojo (`Input status="error"` + `Tooltip` con el motivo) si el campo obligatorio falta, si el correo no tiene formato válido, o si el **DNI/NIE no supera la letra de control** (`detectDocumentType` de `client/src/utils/detect-document-type.ts`, el mismo validador que usa el resto de la app — no se duplica el algoritmo). Es un aviso puramente visual: **no bloquea nada** — al pulsar "Guardar" con filas en rojo se guarda igualmente y solo se muestra un `message.warning` avisando de cuántas filas quedaron incompletas/inválidas (el backend tampoco las rechaza, ver arriba).

## Excel de alta (`course-request-excel.parser.ts`)

ExcelJS, primera hoja. Detección de columnas **por nombre de cabecera** (normalizado: mayúsculas, sin acentos, espacios colapsados — `course-request-column-map.ts`), no por posición: los centros no siempre respetan el orden ni el nombre exacto. Alias reconocidos por campo (NOMBRE; APELLIDO 1/APELLIDO1/AP1/PRIMER APELLIDO; APELLIDO 2/APELLIDO2/AP2/SEGUNDO APELLIDO; DNI/NIF/NIF-NIE; CORREO ELECTRONICO/EMAIL/CORREO; TELEFONO MOVIL/MÓVIL/TELEFONO). Columnas no reconocidas (p. ej. CENTRO) se ignoran sin error; si aparecen **dos columnas que matchean el mismo campo** (p. ej. dos "email", una del alumno y otra de contacto del centro), gana la **primera** — por eso el orden real de la plantilla (NOMBRE, apellidos, DNI, email del alumno, móvil, luego centro/otro email) resuelve la ambigüedad sin configuración. Filas totalmente vacías se descartan. El fichero **no** se guarda (solo se procesa en memoria). El mismo mapa de alias (duplicado, sin compartir código) se usa en el cliente para el pegado manual (`course-request-students-grid.tsx`).

## Flujo (`course-request.service.ts`)

- `create`: cabecera; `id_center`/`contact_email` nullable (se avisa en el cliente si faltan, no se bloquea).
- `findAll`: **urgentes primero**, luego más recientes primero (`ORDER BY is_urgent DESC, createdAt DESC`).
- `saveStudents` (`PUT :id/students`): **sustituye** todas las filas (guardado desde la grid, validado por fila).
- `uploadExcel` (`POST :id/upload`): **añade** filas al final (no sustituye lo ya guardado) y marca `source=EXCEL`.
- `close`/`reopen`: cambian `status`/`closed_at`. Editar cabecera o alumnos de una petición **CERRADA** lanza `ConflictException` — hay que reabrirla primero.
- `remove`: borra la cabecera; las filas caen en cascada (FK `ON DELETE CASCADE`).
- `stats`: agregados para el dashboard del listado (Card "Por curso", único bloque — se quitó el de "Por centro / empresa"). `byCourse` (nº de peticiones y de alumnos por curso, ordenado por `student_count` descendente). `byCourseCompany` (`CourseRequestRepository.statsByCourseCompany`, `INNER JOIN` centro+empresa — solo peticiones con centro y empresa): nº de peticiones por combinación curso/empresa, usado por el cliente para pintar **una columna por cada empresa con peticiones** dentro de la tabla "Por curso" (pivote curso × empresa, celda = nº de peticiones de esa empresa para ese curso). El pivote se arma en el cliente (`course-requests.route.tsx`): columnas dinámicas derivadas de `byCourseCompany`, filas de `byCourse`, `Map` `"<id_course>-<id_company>"` → `request_count` para el lookup de celdas.
- `report` (`course-request-pdf.service.ts` para el PDF): filas empresa/centro/curso con nº de peticiones y alumnos, filtrables por cualquier combinación de `id_company`/`id_center`/`id_course` (`CourseRequestRepository.reportRows`, `LEFT JOIN` hasta `course_request_students` + `GROUP BY`). El PDF agrupa esas filas Empresa → Curso → Centro con totales por curso/empresa/general, escrito directamente con `PdfService` (estilo del informe de bonificación de `api/reports/` — el renderer de plantillas JSON solo soporta tablas planas, no 3 niveles de agrupación) — módulo independiente, sin importar nada de `api/reports/`.

## Endpoints (`api/course-requests`, `RoleGuard([ADMIN, MANAGER])`)

`POST /`, `GET /` (filtros `id_course`/`id_center`/`id_company`/`status`), `GET /stats`, `GET /report` (filtros `id_company`/`id_center`/`id_course`), `GET /report/pdf` (mismos filtros, streama el PDF), `GET /:id`, `PUT /:id`, `PUT /:id/students`, `POST /:id/upload`, `PUT /:id/close`, `PUT /:id/reopen`, `DELETE /:id`. `report`/`report/pdf` están declarados **antes** de `GET /:id` en el controlador para que Nest no intente parsear "report" como un ID.

## Cliente

Sección de primer nivel `/course-requests` (no bajo `/tools`; visible en el menú solo para ADMIN/MANAGER, igual que el guard del backend). `course-requests.route.tsx` usa `RouteTabs` con dos pestañas:
- **Peticiones**: listado + dos tablas de resumen (por curso, por centro/empresa) desde `/stats`, filtros por curso/centro/estado. Columna **Urgente** con `Switch` inline (toggle inmediato vía `useToggleCourseRequestUrgentMutation`, con `stopPropagation` para no disparar la navegación de la fila) y fila resaltada en rojo (`rowClassName="course-request-urgent-row"`, estilo en `index.css` — tinte translúcido, válido en claro/oscuro). El toggle falla con mensaje si la petición está cerrada (mismo guard de `ensureOpen` que el resto de ediciones).
- **Informes** (`components/course-requests/course-request-report-tab.tsx`): filtros empresa (`Select mode="multiple"` — **varias empresas a la vez**)/centro/curso (combinables), tabla agrupada Empresa → Curso → Centro (mismas filas de `/report`, con `rowSpan` calculado en cliente para fusionar celdas repetidas de Empresa/Curso — sin depender de ninguna librería de árbol/pivote), tarjetas de totales, y botón "Exportar a PDF" (`use-course-request-report-pdf.mutation.ts`, descarga vía blob).
  - `id_company` viaja como array (`CourseRequestReportFilterDto`, `dto/course-request-report-filter.dto.ts`): axios serializa `id_company[]=1&id_company[]=2`, `qs` (Express) lo parsea a array, y un `@Transform` propio (`toPositiveIntArray`) lo normaliza admitiendo también un único valor suelto o ausencia (`undefined`, no filtra). El repositorio usa `inArray(companyTable.id_company, ...)` en `reportRows` (tipo dedicado `CourseRequestReportFilters`, distinto del `CourseRequestFilters` del listado/`stats`, que sigue con empresa única — no se ha tocado).

Resto de pantallas:
- `create-course-request.route.tsx` y la pestaña "Datos" de `course-request-detail.route.tsx`: se busca **directamente por centro** (`Select` sobre todos los centros); la empresa se muestra derivada (solo lectura, cruzando `center.id_company` contra la lista de empresas) — no hay selector de empresa independiente. El correo de contacto se prellena desde `center.contact_email` al elegir centro (editable después, sin volver a sobrescribirse).
- `components/course-requests/course-request-students-grid.tsx`: grid editable simple (sin librería de grid nueva) — `Input` por celda, añadir/borrar fila, "Pegar desde Excel" (modal con textarea, detecta cabecera o usa el orden fijo nombre/apellido1/apellido2/dni/email/teléfono), "Subir Excel", validación cliente de obligatorios antes de guardar.
- Hooks en `hooks/api/course-requests/`.

## Fuera de alcance (diferido a propósito)

- Matricular alumnos de una petición en un grupo (futuro, desde grupos).
- Vincular petición ↔ matrícula/usuario.
- Envío de informes de seguimiento por correo al `contact_email`.
- Grid tipo Excel avanzada (multi-selección de celdas, pegado de rangos parciales).
