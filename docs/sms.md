# SMS (Mailrelay)

Envío de SMS a alumnos vía la API transaccional de [Mailrelay](https://apidocs.mailrelay.com/). Réplica deliberada de la arquitectura de `api/mail/` (ver `docs/mail-moodle.md`): mismas convenciones de guards, cifrado de secretos, log best-effort y variables de plantilla.

## Modelo de datos

- `sms_settings` (`server/src/database/schema/tables/sms_settings.table.ts`): singleton (`id=1`). `account_url` (subdominio Mailrelay, sin protocolo, ej. `mecohisa1.ipzmarketing.com`), `api_key` (cifrada con `secrets.util.ts`, mismo patrón que `smtp_settings.password`), `sender_name` (remitente por defecto, editable en cada envío).
- `sms_templates` (`sms_templates.table.ts`): `name` único, `message` (texto plano — sin `subject`/`is_html`, a diferencia de `mail_templates`).
- `sms_log` (`sms_log.table.ts`): quién/cuándo/a quién/con qué plantilla y remitente. **Nunca guarda el texto del mensaje** (puede contener `{CLAVE_MOODLE}`), igual que `email_log`. Además de los campos calcados de `email_log` (`actor_*`, `template_*`, `status`/`error_message`), guarda `mailrelay_id` (id devuelto por `POST /sms/send`, usado para refrescar el estado) y `mailrelay_status`/`mailrelay_status_checked_at`/`parts_count`/`used_credits`, rellenados solo cuando se pulsa "Actualizar estado" (no hay webhook de Mailrelay).

## Integración con Mailrelay

Cliente HTTP fino: `server/src/api/sms/mailrelay-sms.client.ts` (axios, mismo patrón que `MoodleService` para sus WS).

- Base URL: `https://{account_url}/api/v1`. Auth: header `X-AUTH-TOKEN: <api_key>`.
- `POST /sms/send` — body `{ to: string[] (máx 50, formato E.164), sender_name: string, message: string }`, los 3 obligatorios. Respuesta `201` con array `[{id, subscriber_id, phone, created_at}]` — se usa `to: [unTeléfono]` siempre (un envío por destinatario, igual que el bucle de `SendMailToGroupModal`), porque cada alumno tiene variables `{USUARIO_MOODLE}`/`{CLAVE_MOODLE}` distintas.
- `GET /sms/sent_messages/{id}` — estado real: `not_processed|processed|ignored|delivered|failed|expired`, `processed_at`, `delivered_at`, `used_credits`, `parts_count`. Se llama solo al pulsar "Actualizar estado" en el Registro de envíos (no hay webhook documentado).
- No existe endpoint dedicado de "test de conexión": se usa `GET /sms/sent_messages?per_page=1` como ping autenticado (200 = credenciales válidas, 401 = inválidas).
- **Mailrelay exige un enlace de baja en cada SMS** (rechaza con `422 "Your campaign must contain an unsubscribe URL"` si no lo lleva): `SmsService.ensureUnsubscribeUrl()` añade `Baja SMS: {{ unsubscribe_url }}` al final del mensaje automáticamente si la plantilla/mensaje libre no lo incluye ya, para que ninguna plantilla creada sin saberlo rompa el envío. Detectado en producción 2026-09-11. El enlace en sí (dominio, longitud) lo genera Mailrelay y se configura, si se quiere personalizar, desde su propio panel (dominio personalizado para enlaces cortos) — no es algo que controle la app.
- **Límite de coste: 1 SMS (160 caracteres GSM-7 / 70 UCS-2), incluido el pie de baja** — decisión explícita 2026-09-11, `SmsService.MAX_SMS_PARTS = 1`. `sendSms()` calcula la longitud del mensaje ya resuelto (variables + pie) con `utils/sms/sms-length.util.ts` (duplicado server/client, mismo criterio que `resolveToken`) y lanza `BadRequestException` (registrada en `sms_log` como `failed`) si se supera — nunca llega a llamar a Mailrelay. `POST /sms/preview-length` (mismos guards que `send`) calcula ese recuento para un alumno y curso concretos y devuelve `{length, parts, encoding, limitParts, preview}` — lo usa `SendSmsToGroupModal` contra el primer alumno seleccionado con teléfono, tanto para avisar/bloquear el botón "Enviar" *antes* del envío masivo como para mostrar la vista previa del texto justo debajo del editor de mensaje. El editor de plantillas (`Create/EditSmsTemplateModal`) muestra un contador aproximado (plantilla + pie, sin el nombre real del curso) como primera señal, pero el cálculo exacto es el de `preview-length`.
  - `preview` es el mensaje ya resuelto (variables + `Baja SMS:`), pero con `{USUARIO_MOODLE}`/`{CLAVE_MOODLE}` **enmascarados** (`••••••`) cuando tienen valor real — nunca devuelve la clave de Moodle en claro en una respuesta de API. `length`/`parts`/`encoding` sí se calculan sobre el mensaje real (con las credenciales reales), para que el recuento sea exacto — la máscara es solo cosmética, no afecta al cómputo. Añadido 2026-09-18 a petición del usuario, tras un reporte de que el SMS de prueba "no convertía las variables" — hasta entonces el endpoint deliberadamente no devolvía ningún texto.
  - `missingVariables`: variables que el mensaje usa pero no tienen valor con el que sustituirlas (mismo criterio que bloquea el envío, ver abajo) — solo informativo aquí (no bloquea `preview-length`), pero `SendSmsToGroupModal` lo usa para desactivar el botón "Enviar" y avisar antes de intentar.
- **Antes de enviar, `SmsService` comprueba que toda variable presente en el mensaje tiene valor** (`assertVariablesHaveValue`/`findMissingVariables`, `sms.service.ts`) — si no, lanza `BadRequestException` y no llega a llamar a Mailrelay ni a `sendSms`. Dos categorías, porque no tienen el mismo caso legítimo de estar vacías:
  - `{NOMBRE_CURSO}`/`{NOMBRE_CURSO_CORTO}`/`{FECHA_INICIO}`/`{FECHA_FIN}` (vienen del grupo/curso, no del alumno): se exigen siempre que aparezcan en el mensaje, también en el envío de prueba.
  - `{USUARIO_MOODLE}`/`{CLAVE_MOODLE}` (vienen del alumno): solo se exigen cuando el envío tiene un `userId` real. En el envío de prueba (sin alumno real) quedan vacías a propósito y **no** bloquean — ver más abajo.
  - Se comprueba en `withAppliedVariables` (mensaje personalizado/editado — cubre el envío masivo y la prueba) y en `sendSmsFromTemplate` (plantilla enviada tal cual, sin editar) — en ambos casos con el mensaje *sin sustituir*, para saber qué variables usa el mensaje antes de aplicar los valores.
- Teléfonos: `users.phone` se guarda saneado pero normalmente sin prefijo internacional (`phone.util.ts`). `toE164Phone()` antepone `+34` si no hay `+` (base de usuarios española).

## Variables de plantilla

Mismo catálogo base que el correo (`client/src/constants/mail/mail-template-variables.ts` → `MAIL_TEMPLATE_VARIABLES`): `{NOMBRE_CURSO} {FECHA_INICIO} {FECHA_FIN} {USUARIO_MOODLE} {CLAVE_MOODLE}`. SMS añade una variable propia, **`{NOMBRE_CURSO_CORTO}`** (nombre corto del *curso de catálogo*, `catalog_courses.short_name` — ver `docs/course-catalog.md`), expuesta a través de `SMS_TEMPLATE_VARIABLES` (mismo fichero de constantes) — deliberadamente **no** en `MAIL_TEMPLATE_VARIABLES`/`REPORT_MAIL_TEMPLATE_VARIABLES`, así que no aparece en los editores de plantillas de correo. La usan los botones de inserción de `Create/EditSmsTemplateModal` y el propio `SendSmsToGroupModal` (mensaje editado del envío a grupo).

`SmsService.buildTemplateVariables`/`applyVariables` (`server/src/api/sms/sms.service.ts`) son una **copia deliberada** de los métodos privados equivalentes de `MailService` — no hay helper compartido, mismo criterio ya documentado para `MailService.resolveToken`. Si se cambia el set de variables en un lado, replicar manualmente en el otro (`{NOMBRE_CURSO_CORTO}` es la excepción intencional: solo SMS).

`courseShortName` viaja igual que `courseName` (resuelto en el cliente, no en el servidor, a partir de un id de curso): en el envío desde la pantalla de grupo, `group-detail.route.tsx` lo toma de `courseData.catalog_course_short_name` (join `catalog_courses` añadido a `CourseRepository.findById`) y lo propaga por `GroupUsersManager` → `SendSmsToGroupModal` → `SendSmsOptions`/`SendSmsFromTemplateOptions`/`PreviewSmsLengthOptions`.

## Endpoints y guards

Mismo patrón que mail (`AuthGuard` global + `RoleGuard` por endpoint, sin `@Public()`), pero **más restrictivo a propósito** (decisión 2026-09-11): solo `[ADMIN, MANAGER]`, sin `TUTOR` — a diferencia del correo, donde TUTOR también envía. Las lecturas se han acotado igual (sin VIEWER/TUTOR/CONSULTOR), porque ningún otro rol tiene ya ningún uso legítimo de ellas.

- `GET /sms-settings` → `[ADMIN, MANAGER]` (lectura, `api_key` enmascarada a `''` + `hasApiKey`). `POST /sms-settings` → `ADMIN`.
- `POST /sms/connection` → `ADMIN` (prueba de conexión, admite valores del formulario aún no guardados — `api_key` vacía = usar la almacenada).
- `POST /sms/send`, `POST /sms/send-from-template`, `POST /sms/preview-length` → `[ADMIN, MANAGER]`.
- `GET /sms-templates`, `GET /sms-templates/:id` → `[ADMIN, MANAGER]`. `POST/PUT/DELETE /sms-templates` → `ADMIN`.
- `GET /sms-log`, `POST /sms-log/:id/refresh-status` → `ADMIN` (mismo criterio que `email-log`).

Ver `docs/permissions-matrix.md` §5b para la tabla completa (mantenerla sincronizada con `permissions-matrix.content.ts`, bloque `key: 'sms'`).

## Frontend

- `client/src/components/sms/SmsConfigTab.tsx` — Administración → SMS (`/organization/sms`, ADMIN-only): cuenta/api_key/remitente por defecto, "Probar conexión", "Enviar SMS de prueba".
- `SmsTemplatesTab.tsx` + modales — gestor de plantillas SMS (texto plano, sin editor HTML ni subida de imagen).
- `SmsLog.tsx` (`/tools/sms-log`) — registro de envíos, con botón "Actualizar estado" por fila.
- `SendSmsToGroupModal.tsx` — botón "SMS" en la pantalla de grupo (junto al de "Correo"), junto a `SendMailToGroupModal`: selector de plantilla + remitente (prellenado con el `sender_name` por defecto, editable), envío iterando los alumnos seleccionados con teléfono.
  - **Mensaje editable**: al elegir la plantilla, su texto se carga en un `Input.TextArea` editable (con los mismos botones de variables), para poder acortarlo si supera el límite — la longitud (`preview-length`) se recalcula contra el texto editado con un debounce de 350ms. Botón "Restaurar texto de la plantilla" si se ha editado.
  - **Ruta de envío dual** (`SmsService.sendSms` vs `sendSmsFromTemplate`): si el mensaje coincide con el de la plantilla guardada, se envía vía `POST /sms/send-from-template` (`templateId`, queda asociado en `sms_log`); si se ha editado, se envía vía `POST /sms/send` con `applyVariables: true` + `userId`/`courseName`/`courseStart`/`courseEnd` (mismo mecanismo que el correo personalizado de `MailService`) — el registro no queda asociado a ninguna plantilla en ese caso (mismo comportamiento que el "correo personalizado" de mail). El botón "Enviar prueba" siempre usa esta segunda vía (sin `userId`, así que `{USUARIO_MOODLE}`/`{CLAVE_MOODLE}` resuelven vacío).

## Precedente sustituido

`useExportUsersToSmsCsv` (export CSV manual `telefono;"mensaje";remitente` para subir a mano a otro panel) queda como alternativa manual; este sistema la sustituye por el envío real vía API para el flujo normal.
