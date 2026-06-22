# Duplicado de Foros (`api/forum`)

Herramienta para replicar un **tema modelo** de los foros de un curso Moodle a
**todos los grupos** seleccionados (un tema por grupo), conservando texto/HTML e
imágenes/enlaces/vídeos embebidos. Cada tema se publica **en nombre del tutor de
su grupo** (autoría real vía el token WS del tutor).

Read before touching `api/forum/` o los métodos de foro en `MoodleService`.

## Modelo y decisiones de diseño
- El curso se selecciona por su **id LOCAL** (donde viven grupos, tutores y
  tokens). Su `moodle_id` se resuelve en `ForumService` para llamar a Moodle.
- **Autoría = tutor de cada grupo** (`user_group.is_tutor = true`). Un tema en el
  grupo G se crea con el token del tutor de G. En grupos con varios tutores, el
  usuario elige cuál publica (en la previsualización).
- **Texto = tema modelo existente**: por cada foro se señala un tema ya creado y
  se replica asunto + cuerpo al resto de grupos.
- **Idempotente**: se omiten los grupos que ya tengan un tema con el mismo asunto
  (se detecta con `mod_forum_get_forum_discussions`, que devuelve `groupid` por
  tema).
- Los foros deben estar en **grupos separados/visibles** para admitir un tema por
  grupo (Moodle: `groupid` en `mod_forum_add_discussion`).

## Token del tutor
El tutor es un `user` con `is_tutor` en `user_group`. Su token WS se resuelve por:
`moodle_user_auth_user.moodle_token` (principal) → `auth_user.moodleToken`
(respaldo). `UserGroupRepository.findGroupTutors(groupId)` agrega por usuario
(varias cuentas Moodle/tokens posibles), prefiere la cuenta `is_main_user` para el
`moodle_id` del autor y expone `has_token`. Un tutor sin token deja su grupo
**bloqueado** en la previsualización sin romper el lote.

## Funciones WS de Moodle
Habilitar en el servicio externo (además de activar **"Can download files"** y
**"Can upload files"** para los adjuntos/inline):
- `mod_forum_get_forums_by_courses` — foros del curso (`MoodleService.getCourseForums`).
- `mod_forum_get_forum_discussions` — temas de un foro (`MoodleService.getForumDiscussions`).
- `mod_forum_get_discussion_posts` — cuerpo HTML + ficheros del tema modelo *(Fase 4)*.
- `mod_forum_add_discussion` — crea el tema por grupo (`groupid`) *(Fase 3)*.
Reutiliza `core_group_get_course_groups` y `core_enrol_get_enrolled_users` (ya activos).

Capabilities del token de cada tutor (las trae el rol teacher): `mod/forum:startdiscussion`,
`mod/forum:viewdiscussion`, `moodle/site:accessallgroups`, `webservice/rest:use`.

## Endpoints (Fase 2 — lectura)
`ForumController` (`@Controller('api/forum')`, convención de módulos nuevos →
alcanzable por el proxy `/api` de Vite), todos bajo `@UseGuards(RoleGuard([ADMIN, MANAGER]))`:
- `GET /api/forum/courses/:courseId/forums` — foros del curso local (resuelve `moodle_id`).
- `GET /api/forum/forums/:forumId/discussions` — temas de un foro (para elegir modelo).
- `GET /api/forum/courses/:courseId/groups-with-tutors` — grupos del curso con sus
  tutores y `has_token`.

`:courseId` es el id **LOCAL** del curso. Requieren JWT (AuthGuard global) + rol
ADMIN/MANAGER; un GET sin token devuelve 401 (no datos).

## Endpoint (Fase 3 — preview, no escribe)
- `POST /api/forum/duplicate/preview` — body `DuplicateForumDto`
  (`src/dto/forum/duplicate-forum.dto.ts`): `{ courseId (local), forumIds[],
  groupIds[] (locales), models?[{forumId,discussionId}], tutorByGroup?[{id_group,id_user}] }`.
  Devuelve `PreviewDuplicationResultDto`: `groups` (con `selectedTutor` y
  `tutorAmbiguous`), `forums` (con `model`, `modelNeedsSelection`,
  `availableModels` y la matriz `cells`) y `summary {toCreate,toSkip,blocked}`.
  - **Modelo por foro**: override en `models`; si no y el foro tiene 1 tema, ese;
    si tiene varios → `modelNeedsSelection` y celdas `blocked_no_model`.
  - **Tutor por grupo**: override en `tutorByGroup`; si no, primer tutor con token.
  - **Idempotencia**: omite (`skip_exists`) si el foro ya tiene un tema con
    `groupid == group.moodle_id` y el mismo asunto (normalizado: trim + espacios).
  - **Bloqueos**: `blocked_no_model` / `blocked_no_group_moodle_id` /
    `blocked_no_tutor` / `blocked_no_token`.
  - No escribe nada en Moodle (seguro de ejecutar para verificar).

## Endpoint (Fase 3 — execute, ESCRIBE)
- `POST /api/forum/duplicate/execute` — mismo body `DuplicateForumDto`. Recalcula
  el plan en servidor (`buildPlan`, no se fía del cliente) y crea un tema por cada
  celda `create`. Devuelve `ExecuteDuplicationResultDto`: `preview` (plan
  recalculado), `results[]` por celda (`created` con `discussionId` / `error`) y
  `summary {created,failed,skipped,blocked}`.
  - **Autoría**: cada tema se crea con `mod_forum_add_discussion` firmado con el
    **token del tutor** del grupo (`request({ token })`), resuelto por
    `resolveTutorToken(id_user)` (cuenta principal → `findTopMoodleLinkByMoodleUserId`
    → `moodle_token`). Token cacheado por tutor.
  - **Cuerpo**: se lee el post inicial del tema modelo con
    `mod_forum_get_discussion_posts` (cacheado 1 vez por foro) y se publica su HTML.
  - **Media (Fase 4, hecho)**: las imágenes embebidas se copian. Ver abajo.
  - **Errores aislados** por celda (uno no tumba el lote). Auditado por `AuditInterceptor`.

## Imágenes/ficheros embebidos (Fase 4)
Moodle **NO** lista las imágenes de los posts de foro en `messageinlinefiles` (viene
vacío) y el `message` referencia la imagen con la **URL completa**
`…/webservice/pluginfile.php/…`. Por eso `buildForumContent(message)`:
1. Parsea el HTML buscando URLs `pluginfile.php` (regex sobre `src`/`href`).
2. **Descarga** cada fichero una vez (con el token de la org) — `MoodleService.downloadFile`.
3. Reescribe la URL a `@@PLUGINFILE@@/<fichero>` en una plantilla de mensaje.
Luego, **por cada tema** (el draft es per-usuario y se consume al crear), sube los
ficheros al **draft del tutor** (`MoodleService.uploadToDraftArea` → `upload.php`,
mismo `itemid` para agrupar) y crea el tema con `options[inlineattachmentsid]=draftid`
y el mensaje-plantilla; Moodle re-vincula las imágenes al nuevo post. Descarga
cacheada por foro; subida por tema. Enlaces y vídeos embebidos (iframe) no son
pluginfile → viajan intactos. Si una descarga falla, el tema se crea igual (con la
URL original) y se reporta en `mediaWarning`.

### `MoodleService` (cambios Fases 3-4)
`request()` acepta `token?` explícito (override del token de org). Nuevos:
`getDiscussionPosts(discussionId)`, `addForumDiscussion(forumId, subject, message, groupId, token, options?)`,
`downloadFile(fileUrl, token?)` (añade `?token=`), `uploadToDraftArea(buffer, filename, token, itemId?)`
(multipart a `<origin>/webservice/upload.php` con `FormData`/`Blob` globales).
Endpoint de inspección: `GET /api/forum/discussions/:discussionId/posts` → `ModelPostDto[]`
(cuerpo HTML + ficheros), para previsualizar el modelo.

Tipos de respuesta en `src/dto/forum/forum.dto.ts`.

## Frontend (Fase 5)
Herramienta en Administración → Herramientas → "Duplicado de Foros"
(`ToolList.tsx`, ruta `/tools/forum-duplicator`). Componente
`client/src/components/tools/ForumDuplicator.tsx` (asistente en una página):
1. **Curso**: `Select` con búsqueda, sólo cursos con `moodle_id` (`useCoursesQuery`).
2. **Foros**: `Table` con selección múltiple (`useCourseForumsQuery`); botón
   "sólo pregunta-respuesta" (filtra `type === 'qanda'`).
3. **Grupos**: `Table` con selección múltiple (`useCourseGroupsWithTutorsQuery`);
   en grupos multi-tutor, `Select` por fila para elegir el autor.
4. **Previsualizar** (`useForumPreviewMutation`) → resumen + matriz aplanada
   foro×grupo con `Tag` de estado (`CELL_STATUS_META`). Si un foro tiene varios
   temas, `Alert` con `Select` de modelo por foro (volver a previsualizar).
5. **Ejecutar** (`useForumExecuteMutation`, `window.confirm`) → tabla de resultados
   (creado/error + `mediaWarning`). Habilitado sólo si `toCreate > 0`.

Hooks en `client/src/hooks/api/forum/`; tipos espejo en
`client/src/shared/types/forum/forum.ts`. Las rutas del cliente usan el prefijo
`/api/forum/...` (proxy Vite).

**Punto de entrada desde la ficha de curso**: botón "Foros" (icono `CommentOutlined`,
`AuthzHide [ADMIN, MANAGER]`) junto a "Añadir Grupo al Curso" en
`course-detail.route.tsx`; navega a `/tools/forum-duplicator?courseId=<id>`.
`ForumDuplicator` lee `courseId` con `useSearchParams`: lo fija, deshabilita el
`Select` de curso y muestra "Curso fijado desde su ficha".

## Plan por fases
1. (Operación en Moodle) Habilitar funciones WS + flags de ficheros; tutores con token. ✅
2. **Backend lectura** (este doc): foros, temas, grupos+tutores. ✅
3. Backend escritura sin ficheros: `mod_forum_add_discussion(groupid)` con token por
   grupo + idempotencia (preview/execute).
4. Backend ficheros embebidos: descarga del modelo → subida al draft area del tutor
   (`upload.php`) → `options[inlineattachmentsid]`.
5. Frontend: asistente curso → foros → tema modelo → grupos+tutor → preview → ejecutar.
6. Tests + cierre de docs.
