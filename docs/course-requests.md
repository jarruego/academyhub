# Peticiones de centros

**Leer antes de tocar `api/course-request/`.**

Gestor de peticiones de formación que envían los centros/clientes (normalmente centros privados pidiendo cursos FUNDAE). Un centro manda por Excel (o se pega a mano) el listado de alumnos que necesitan una formación concreta; se guarda como una "petición" con su centro, curso y correo de contacto, editable como una hoja de cálculo.

## Alcance de esta fase

Solo alta/gestión de la petición en sí (cabecera + filas de alumnos). **No** se toca `users` ni se genera matrícula: los datos de alumnos son texto en bruto. La matriculación desde estas peticiones (varias peticiones de distintos centros pudiendo aportar alumnos a un mismo grupo) se hará más adelante desde la pantalla de grupos; por eso una petición se puede cerrar manualmente ya, o (en el futuro) al usarse para matricular.

## Modelo de datos

- `course_requests` (cabecera): `id_center` (nullable — normal que exista, pero no se bloquea si falta), `id_course` (obligatorio), `contact_email` (nullable, para futuros informes de seguimiento), `status` (`ABIERTA`/`CERRADA`), `source` (`EXCEL`/`MANUAL`, según el último alta de alumnos), `notes`, `created_by`, `closed_at`. Índices por `id_course`, `id_center`, `status`.
- `course_request_students` (filas, ON DELETE CASCADE desde la cabecera): `name`, `first_surname`, `dni`, `email` (**NOT NULL**, pero admiten `''` — ver parser), `second_surname`, `phone_mobile` (opcionales). `row_order` para el orden de la grid.

Obligatorios para poder **guardar** una fila desde la grid (`PUT :id/students`, validado por `CourseRequestStudentDto`): nombre, apellido 1, DNI, correo (formato email). La subida de Excel (`POST :id/upload`) **no** aplica esta validación — inserta lo que reconozca (posiblemente vacío) para que el usuario lo complete en la grid antes de guardar; por eso las columnas de texto son NOT NULL pero aceptan `''`.

## Excel de alta (`course-request-excel.parser.ts`)

ExcelJS, primera hoja. Detección de columnas **por nombre de cabecera** (normalizado: mayúsculas, sin acentos, espacios colapsados — `course-request-column-map.ts`), no por posición: los centros no siempre respetan el orden ni el nombre exacto. Alias reconocidos por campo (NOMBRE; APELLIDO 1/APELLIDO1/AP1/PRIMER APELLIDO; APELLIDO 2/APELLIDO2/AP2/SEGUNDO APELLIDO; DNI/NIF/NIF-NIE; CORREO ELECTRONICO/EMAIL/CORREO; TELEFONO MOVIL/MÓVIL/TELEFONO). Columnas no reconocidas (p. ej. CENTRO) se ignoran sin error; si aparecen **dos columnas que matchean el mismo campo** (p. ej. dos "email", una del alumno y otra de contacto del centro), gana la **primera** — por eso el orden real de la plantilla (NOMBRE, apellidos, DNI, email del alumno, móvil, luego centro/otro email) resuelve la ambigüedad sin configuración. Filas totalmente vacías se descartan. El fichero **no** se guarda (solo se procesa en memoria). El mismo mapa de alias (duplicado, sin compartir código) se usa en el cliente para el pegado manual (`course-request-students-grid.tsx`).

## Flujo (`course-request.service.ts`)

- `create`: cabecera; `id_center`/`contact_email` nullable (se avisa en el cliente si faltan, no se bloquea).
- `saveStudents` (`PUT :id/students`): **sustituye** todas las filas (guardado desde la grid, validado por fila).
- `uploadExcel` (`POST :id/upload`): **añade** filas al final (no sustituye lo ya guardado) y marca `source=EXCEL`.
- `close`/`reopen`: cambian `status`/`closed_at`. Editar cabecera o alumnos de una petición **CERRADA** lanza `ConflictException` — hay que reabrirla primero.
- `remove`: borra la cabecera; las filas caen en cascada (FK `ON DELETE CASCADE`).
- `stats`: agregados `byCourse` / `byCenter` (nº de peticiones y de alumnos), para el dashboard del listado.
- `report` (`course-request-pdf.service.ts` para el PDF): filas empresa/centro/curso con nº de peticiones y alumnos, filtrables por cualquier combinación de `id_company`/`id_center`/`id_course` (`CourseRequestRepository.reportRows`, `LEFT JOIN` hasta `course_request_students` + `GROUP BY`). El PDF agrupa esas filas Empresa → Curso → Centro con totales por curso/empresa/general, escrito directamente con `PdfService` (estilo del informe de bonificación de `api/reports/` — el renderer de plantillas JSON solo soporta tablas planas, no 3 niveles de agrupación) — módulo independiente, sin importar nada de `api/reports/`.

## Endpoints (`api/course-requests`, `RoleGuard([ADMIN, MANAGER])`)

`POST /`, `GET /` (filtros `id_course`/`id_center`/`id_company`/`status`), `GET /stats`, `GET /report` (filtros `id_company`/`id_center`/`id_course`), `GET /report/pdf` (mismos filtros, streama el PDF), `GET /:id`, `PUT /:id`, `PUT /:id/students`, `POST /:id/upload`, `PUT /:id/close`, `PUT /:id/reopen`, `DELETE /:id`. `report`/`report/pdf` están declarados **antes** de `GET /:id` en el controlador para que Nest no intente parsear "report" como un ID.

## Cliente

Sección de primer nivel `/course-requests` (no bajo `/tools`; visible en el menú solo para ADMIN/MANAGER, igual que el guard del backend). `course-requests.route.tsx` usa `RouteTabs` con dos pestañas:
- **Peticiones**: listado + dos tablas de resumen (por curso, por centro/empresa) desde `/stats`, filtros por curso/centro/estado.
- **Informes** (`components/course-requests/course-request-report-tab.tsx`): filtros empresa/centro/curso (combinables), tabla agrupada Empresa → Curso → Centro (mismas filas de `/report`, con `rowSpan` calculado en cliente para fusionar celdas repetidas de Empresa/Curso — sin depender de ninguna librería de árbol/pivote), tarjetas de totales, y botón "Exportar a PDF" (`use-course-request-report-pdf.mutation.ts`, descarga vía blob).

Resto de pantallas:
- `create-course-request.route.tsx` y la pestaña "Datos" de `course-request-detail.route.tsx`: se busca **directamente por centro** (`Select` sobre todos los centros); la empresa se muestra derivada (solo lectura, cruzando `center.id_company` contra la lista de empresas) — no hay selector de empresa independiente. El correo de contacto se prellena desde `center.contact_email` al elegir centro (editable después, sin volver a sobrescribirse).
- `components/course-requests/course-request-students-grid.tsx`: grid editable simple (sin librería de grid nueva) — `Input` por celda, añadir/borrar fila, "Pegar desde Excel" (modal con textarea, detecta cabecera o usa el orden fijo nombre/apellido1/apellido2/dni/email/teléfono), "Subir Excel", validación cliente de obligatorios antes de guardar.
- Hooks en `hooks/api/course-requests/`.

## Fuera de alcance (diferido a propósito)

- Matricular alumnos de una petición en un grupo (futuro, desde grupos).
- Vincular petición ↔ matrícula/usuario.
- Envío de informes de seguimiento por correo al `contact_email`.
- Grid tipo Excel avanzada (multi-selección de celdas, pegado de rangos parciales).
