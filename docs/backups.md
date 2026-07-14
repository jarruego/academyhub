# Copias de seguridad

Sistema de backup nocturno independiente de la app: un workflow de GitHub Actions (`.github/workflows/backup.yml`) que cada noche a las 03:15 UTC vuelca la base de datos de Supabase con `pg_dump`, la cifra con GPG (AES-256, clave simétrica) y la sube a un bucket S3-compatible externo (Backblaze B2 o Cloudflare R2), y además hace espejo del bucket de Supabase Storage. Retención: 30 días para los dumps; los ficheros borrados en Storage se apartan a `storage-borrados/<fecha>` en vez de eliminarse de la copia.

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

## Decisiones de diseño

- **Fuera de la app**: el backup no depende de que Render esté vivo ni carga su CPU; sobrevive a un fallo o compromiso de la app.
- **Cifrado obligatorio**: los dumps contienen datos personales (DNI, NSS) — RGPD.
- **`pg_dump` 17 vía repo PGDG**: la versión del cliente debe ser ≥ a la del Postgres del proyecto Supabase.
- **Formato custom (`-Fc`)**: permite restauración selectiva por tabla con `pg_restore`.
- Los backups automáticos del plan Pro de Supabase (si se activa) son una segunda línea, no sustituto: viven dentro de Supabase y no cubren Storage.
