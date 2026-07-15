# Copias de seguridad

Sistema de backup nocturno independiente de la app: un workflow de GitHub Actions (`.github/workflows/backup.yml`) que cada noche a las 03:15 UTC vuelca la base de datos de Supabase con `pg_dump`, la cifra con GPG (AES-256, clave simétrica) y la sube a un bucket S3-compatible externo (Backblaze B2 o Cloudflare R2), y además hace espejo del bucket de Supabase Storage. Retención abuelo-padre-hijo: dumps diarios en `db/` 30 días + el del día 1 de cada mes duplicado en `db-monthly/` 365 días (cubre errores detectados tarde: vacaciones, corrupción silenciosa); los ficheros borrados en Storage se apartan a `storage-borrados/<fecha>` en vez de eliminarse de la copia.

Qué cubre y qué no:
- **Cubierto**: base de datos completa y bucket de Supabase Storage (logos/firmas de organización, imágenes de plantillas de correo). Es todo lo irreemplazable: los assets de organización se suben a Supabase Storage (`SupabaseStorageService`), no al disco de Render.
- **No cubierto (a propósito)**: código (ya está en GitHub), frontend Vercel y backend Render (se reconstruyen desde el repo). `server/public/uploads/` en Render es efímero y solo actúa como fallback legacy de rutas antiguas.

## Secrets requeridos (GitHub → Settings → Secrets and variables → Actions)

| Secret | Contenido |
|---|---|
| `SUPABASE_DB_URL` | Cadena de conexión al **session pooler** (puerto 5432; el transaction pooler 6543 no vale para `pg_dump`) |
| `BACKUP_PASSPHRASE` | Frase de cifrado de los dumps. **Guardada también fuera de GitHub** (gestor de contraseñas); sin ella los backups son ilegibles |
| `BACKUP_S3_ENDPOINT` | Endpoint S3 del destino (B2: `https://s3.<region>.backblazeb2.com`; R2: `https://<account_id>.r2.cloudflarestorage.com`) |
| `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_KEY` | Credenciales del bucket destino |
| `BACKUP_S3_BUCKET` | Nombre del bucket destino |
| `SUPABASE_S3_ENDPOINT` | Dashboard Supabase → Storage → Settings → S3 connection (`https://<ref>.supabase.co/storage/v1/s3`) |
| `SUPABASE_S3_REGION` | Región mostrada en esa misma pantalla |
| `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_KEY` | Access keys S3 creadas en esa pantalla |
| `SUPABASE_STORAGE_BUCKET` | Nombre del bucket de Storage (si está vacío, el paso de Storage se omite) |

Lanzamiento manual: pestaña **Actions → Backup nocturno → Run workflow** (útil antes de una migración arriesgada). Si un run programado falla, GitHub avisa por email al dueño del repo.

## Restauración

```bash
# 1. Descargar el .dump.gpg del bucket destino (web o rclone)
# 2. Descifrar (pide la passphrase):
gpg -o db-2026-07-14.dump -d db-2026-07-14.dump.gpg
# 3. Restaurar sobre una BD vacía (local o proyecto Supabase nuevo):
pg_restore --no-owner --no-privileges -d "<DATABASE_URL destino>" db-2026-07-14.dump
```

Ficheros de Storage: `rclone sync` en sentido inverso (de la copia al bucket de Supabase) o descarga manual.

**Prueba de restauración**: al menos una vez tras la puesta en marcha (e idealmente cada pocos meses), restaurar un dump en local y arrancar la app contra él. Un backup nunca restaurado no está verificado.

## Panel de administración (`api/backups`)

Pantalla Administración → Herramientas → "Copias de seguridad" (`/tools/backups`, solo ADMIN). Módulo `server/src/api/backups/` (sin BD propia): `GET status` (últimas 10 ejecuciones del workflow vía API de GitHub), `GET list` (ficheros `db/*.dump.gpg` y `db-monthly/*.dump.gpg` del bucket vía S3 `ListObjectsV2`, con `kind: daily|monthly` → columna "Tipo" en el panel), `POST run` ("Hacer copia ahora" → `workflow_dispatch` sobre `main`) y `POST download-url` (URL prefirmada de 10 min con `Content-Disposition: attachment`; el fichero baja cifrado — la passphrase nunca pasa por la app). Los POST quedan en `audit_log` vía el interceptor global. La key de descarga se valida contra `^(db|db-monthly)/[A-Za-z0-9._-]+\.dump\.gpg$` (sin path traversal ni otros prefijos).

Config por env (todo opcional; el panel muestra alertas de "no configurado" si faltan): `GITHUB_BACKUP_TOKEN` (PAT fine-grained, permiso Actions read+write sobre el repo), `GITHUB_BACKUP_REPO` (default `jarruego/academyhub`) y `BACKUP_S3_*` — **crear en B2 una application key de SOLO LECTURA** para esto, distinta de la de escritura que usan los GitHub Actions (`BACKUP_S3_REGION` es opcional: se deriva del endpoint). Cliente: hooks en `client/src/hooks/api/backups/`, componente `components/tools/BackupsPanel.tsx` (el estado se auto-refresca cada 10 s mientras haya una ejecución en curso). Dependencias servidor: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

**No hay restauración desde el panel, a propósito**: restaurar producción desde una web es un riesgo inaceptable (sesión admin comprometida = datos machacados) y el servidor no puede restaurarse a sí mismo. La restauración es siempre el procedimiento manual de arriba.

## Copia local de desarrollo

Desde 2026-07-15 el desarrollo local usa una restauración del backup en Docker en vez de conectar a producción: contenedor `academyhub-db` (postgres:17, puerto **5433**, volumen `academyhub-pgdata`, `--restart unless-stopped`), BD `academyhub`, usuario `postgres` / contraseña `academyhub`. `server/.env` apunta a `postgresql://postgres:academyhub@127.0.0.1:5433/academyhub`; la URL de producción queda comentada al lado. Requiere Docker Desktop abierto. Ojo: `MOODLE_URL` sigue siendo el Moodle real. La prueba de restauración se validó ese día (dump 2026-07-15: 45.698 users, 305 courses, 821 groups). Al restaurar en postgres vanilla, los 3 errores sobre `supabase_vault` son esperables e inofensivos.

**Refrescar la copia local con datos recientes de producción:**
```powershell
# 1. Descargar el último db-*.dump.gpg de Backblaze a Descargas (la web lo renombra a db_db-....dump.gpg)
# 2. Descifrar (pide la BACKUP_PASSPHRASE):
& "C:\Program Files\Git\usr\bin\gpg.exe" -o db-restore.dump -d db_db-AAAA-MM-DD.dump.gpg
# 3. Recrear la BD local y restaurar:
docker exec academyhub-db psql -U postgres -d postgres -c "DROP DATABASE academyhub WITH (FORCE);"
docker exec academyhub-db psql -U postgres -d postgres -c "CREATE DATABASE academyhub;"
docker cp db-restore.dump academyhub-db:/tmp/db-restore.dump
docker exec academyhub-db pg_restore --no-owner --no-privileges -U postgres -d academyhub /tmp/db-restore.dump
docker exec academyhub-db rm /tmp/db-restore.dump
# 4. Borrar db-restore.dump y el .gpg de Descargas (datos personales)
```

## Decisiones de diseño

- **Fuera de la app**: el backup no depende de que Render esté vivo ni carga su CPU; sobrevive a un fallo o compromiso de la app.
- **Cifrado obligatorio**: los dumps contienen datos personales (DNI, NSS) — RGPD.
- **`pg_dump` 17 vía repo PGDG**: la versión del cliente debe ser ≥ a la del Postgres del proyecto Supabase.
- **Formato custom (`-Fc`)**: permite restauración selectiva por tabla con `pg_restore`.
- Los backups automáticos del plan Pro de Supabase (si se activa) son una segunda línea, no sustituto: viven dentro de Supabase y no cubren Storage.
