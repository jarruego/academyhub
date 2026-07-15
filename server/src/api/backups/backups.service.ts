import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';

/** Fichero de copia listado desde el bucket externo */
export interface BackupFile {
  key: string;
  name: string;
  size: number;
  last_modified: string | null;
}

/** Ejecución del workflow de backup en GitHub Actions */
export interface BackupRun {
  id: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null
  event: string;
  created_at: string;
  updated_at: string;
  duration_seconds: number | null;
  html_url: string;
}

export interface BackupStatusResponse {
  github_configured: boolean;
  s3_configured: boolean;
  runs: BackupRun[];
}

// Las copias viven en <bucket>/db/db-AAAA-MM-DD.dump.gpg (ver .github/workflows/backup.yml)
const BACKUP_KEY_REGEX = /^db\/[A-Za-z0-9._-]+\.dump\.gpg$/;
const DOWNLOAD_URL_TTL_SECONDS = 600;

/** Convierte una ejecución cruda de la API de GitHub al shape que consume el panel */
export function mapWorkflowRun(run: {
  id: number;
  status: string;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}): BackupRun {
  let duration: number | null = null;
  if (run.status === 'completed') {
    const start = Date.parse(run.created_at);
    const end = Date.parse(run.updated_at);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      duration = Math.round((end - start) / 1000);
    }
  }
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    created_at: run.created_at,
    updated_at: run.updated_at,
    duration_seconds: duration,
    html_url: run.html_url,
  };
}

/** Valida que la key pedida es un fichero de copia legítimo (evita presignar objetos arbitrarios) */
export function assertValidBackupKey(key: string): void {
  if (!BACKUP_KEY_REGEX.test(key)) {
    throw new BadRequestException('Invalid backup key');
  }
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private s3Client: S3Client | null = null;

  private get githubToken(): string | undefined {
    return process.env.GITHUB_BACKUP_TOKEN;
  }

  private get githubRepo(): string {
    return process.env.GITHUB_BACKUP_REPO ?? 'jarruego/academyhub';
  }

  private get s3Bucket(): string | undefined {
    return process.env.BACKUP_S3_BUCKET;
  }

  private isS3Configured(): boolean {
    return Boolean(
      process.env.BACKUP_S3_ENDPOINT && process.env.BACKUP_S3_ACCESS_KEY_ID && process.env.BACKUP_S3_SECRET_KEY && this.s3Bucket,
    );
  }

  private getS3Client(): S3Client {
    if (!this.isS3Configured()) {
      throw new ServiceUnavailableException('Backup storage is not configured (BACKUP_S3_* env vars)');
    }
    if (!this.s3Client) {
      const endpoint = process.env.BACKUP_S3_ENDPOINT!;
      // B2 codifica la región en el endpoint (s3.eu-central-003.backblazeb2.com)
      const region = process.env.BACKUP_S3_REGION ?? /s3\.([a-z0-9-]+)\./.exec(endpoint)?.[1] ?? 'us-east-1';
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.BACKUP_S3_SECRET_KEY!,
        },
      });
    }
    return this.s3Client;
  }

  private githubHeaders() {
    return {
      Authorization: `Bearer ${this.githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  /** Últimas ejecuciones del workflow de backup (GitHub Actions) */
  async getStatus(): Promise<BackupStatusResponse> {
    const response: BackupStatusResponse = {
      github_configured: Boolean(this.githubToken),
      s3_configured: this.isS3Configured(),
      runs: [],
    };
    if (!response.github_configured) return response;

    try {
      const url = `https://api.github.com/repos/${this.githubRepo}/actions/workflows/backup.yml/runs`;
      const { data } = await axios.get(url, { headers: this.githubHeaders(), params: { per_page: 10 } });
      response.runs = (data.workflow_runs ?? []).map(mapWorkflowRun);
    } catch (error) {
      this.logger.error(`Failed to fetch workflow runs from GitHub: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('Could not reach GitHub API (check GITHUB_BACKUP_TOKEN)');
    }
    return response;
  }

  /** Lista los ficheros de copia (carpeta db/) del bucket externo */
  async listBackups(): Promise<{ s3_configured: boolean; backups: BackupFile[] }> {
    if (!this.isS3Configured()) return { s3_configured: false, backups: [] };

    const client = this.getS3Client();
    const backups: BackupFile[] = [];
    let continuationToken: string | undefined;
    try {
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: this.s3Bucket, Prefix: 'db/', ContinuationToken: continuationToken }),
        );
        for (const obj of page.Contents ?? []) {
          if (!obj.Key || !BACKUP_KEY_REGEX.test(obj.Key)) continue;
          backups.push({
            key: obj.Key,
            name: obj.Key.replace(/^db\//, ''),
            size: obj.Size ?? 0,
            last_modified: obj.LastModified?.toISOString() ?? null,
          });
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (error) {
      this.logger.error(`Failed to list backups in S3 bucket: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('Could not list backups (check BACKUP_S3_* credentials)');
    }
    backups.sort((a, b) => b.name.localeCompare(a.name));
    return { s3_configured: true, backups };
  }

  /** Lanza el workflow de backup en GitHub (workflow_dispatch sobre main) */
  async triggerBackup(): Promise<{ triggered: boolean }> {
    if (!this.githubToken) {
      throw new ServiceUnavailableException('GitHub integration is not configured (GITHUB_BACKUP_TOKEN)');
    }
    try {
      const url = `https://api.github.com/repos/${this.githubRepo}/actions/workflows/backup.yml/dispatches`;
      await axios.post(url, { ref: 'main' }, { headers: this.githubHeaders() });
    } catch (error) {
      this.logger.error(`Failed to dispatch backup workflow: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('Could not trigger the backup workflow (check token permissions)');
    }
    return { triggered: true };
  }

  /** URL prefirmada de descarga (10 min). El fichero viaja cifrado con GPG. */
  async getDownloadUrl(key: string): Promise<{ url: string; expires_in: number }> {
    assertValidBackupKey(key);
    const client = this.getS3Client();
    const filename = key.replace(/^db\//, '');
    const command = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });
    const url = await getSignedUrl(client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
    return { url, expires_in: DOWNLOAD_URL_TTL_SECONDS };
  }
}
