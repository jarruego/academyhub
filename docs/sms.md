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
- **Límite de coste: 1 SMS (160 caracteres GSM-7 / 70 UCS-2), incluido el pie de baja** — decisión explícita 2026-09-11, `SmsService.MAX_SMS_PARTS = 1`. `sendSms()` calcula la longitud del mensaje ya resuelto (variables + pie) con `utils/sms/sms-length.util.ts` (duplicado server/client, mismo criterio que `resolveToken`) y lanza `BadRequestException` (registrada en `sms_log` como `failed`) si se supera — nunca llega a llamar a Mailrelay. `POST /sms/preview-length` (mismos guards que `send`) calcula ese recuento para un alumno y curso concretos **sin devolver el texto** (podría contener `{CLAVE_MOODLE}`), solo `{length, parts, encoding, limitParts}` — lo usa `SendSmsToGroupModal` contra el primer alumno seleccionado con teléfono para avisar y bloquear el botón "Enviar" *antes* del envío masivo. El editor de plantillas (`Create/EditSmsTemplateModal`) muestra un contador aproximado (plantilla + pie, sin el nombre real del curso) como primera señal, pero el cálculo exacto es el de `preview-length`.
- Teléfonos: `users.phone` se guarda saneado pero normalmente sin prefijo internacional (`phone.util.ts`). `toE164Phone()` antepone `+34` si no hay `+` (base de usuarios española).

## Variables de plantilla

Mismo catálogo que el correo (`client/src/constants/mail/mail-template-variables.ts` → `MAIL_TEMPLATE_VARIABLES`, reutilizado tal cual): `{NOMBRE_CURSO} {FECHA_INICIO} {FECHA_FIN} {USUARIO_MOODLE} {CLAVE_MOODLE}`.

`SmsService.buildTemplateVariables`/`applyVariables` (`server/src/api/sms/sms.service.ts`) son una **copia deliberada** de los métodos privados equivalentes de `MailService` — no hay helper compartido, mismo criterio ya documentado para `MailService.resolveToken`. Si se cambia el set de variables en un lado, replicar manualmente en el otro.

## Endpoints y guards

Mismo patrón que mail (`AuthGuard` global + `RoleGuard` por endpoint, sin `@Public()`):

- `GET /sms-settings` → 5 roles (lectura, `api_key` enmascarada a `''` + `hasApiKey`). `POST /sms-settings` → `ADMIN`.
- `POST /sms/connection` → `ADMIN` (prueba de conexión, admite valores del formulario aún no guardados — `api_key` vacía = usar la almacenada).
- `POST /sms/send`, `POST /sms/send-from-template` → `[ADMIN, MANAGER, TUTOR]` (mismo split que el envío de correo).
- `GET /sms-templates`, `GET /sms-templates/:id` → 5 roles. `POST/PUT/DELETE /sms-templates` → `ADMIN`.
- `GET /sms-log`, `POST /sms-log/:id/refresh-status` → `ADMIN` (mismo criterio que `email-log`).

Ver `docs/permissions-matrix.md` §5b para la tabla completa (mantenerla sincronizada con `permissions-matrix.content.ts`, bloque `key: 'sms'`).

## Frontend

- `client/src/components/sms/SmsConfigTab.tsx` — Administración → SMS (`/organization/sms`, ADMIN-only): cuenta/api_key/remitente por defecto, "Probar conexión", "Enviar SMS de prueba".
- `SmsTemplatesTab.tsx` + modales — gestor de plantillas SMS (texto plano, sin editor HTML ni subida de imagen).
- `SmsLog.tsx` (`/tools/sms-log`) — registro de envíos, con botón "Actualizar estado" por fila.
- `SendSmsToGroupModal.tsx` — botón "SMS" en la pantalla de grupo (junto al de "Correo"), junto a `SendMailToGroupModal`: selector de plantilla + remitente (prellenado con el `sender_name` por defecto, editable), envío iterando los alumnos seleccionados con teléfono.

## Precedente sustituido

`useExportUsersToSmsCsv` (export CSV manual `telefono;"mensaje";remitente` para subir a mano a otro panel) queda como alternativa manual; este sistema la sustituye por el envío real vía API para el flujo normal.
