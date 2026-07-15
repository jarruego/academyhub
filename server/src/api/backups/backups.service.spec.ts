import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { BackupsService, assertValidBackupKey, mapWorkflowRun } from './backups.service';

describe('assertValidBackupKey', () => {
  it('acepta una key de copia legítima', () => {
    expect(() => assertValidBackupKey('db/db-2026-07-15.dump.gpg')).not.toThrow();
  });

  it.each([
    'storage/foto.jpg', // fuera de la carpeta db/
    'db/../secreto.txt', // path traversal
    'db/db-2026-07-15.dump', // sin cifrar
    'db/sub/dir.dump.gpg', // subdirectorios no permitidos
    '', // vacía
  ])('rechaza la key inválida %p', (key) => {
    expect(() => assertValidBackupKey(key)).toThrow(BadRequestException);
  });
});

describe('mapWorkflowRun', () => {
  const base = {
    id: 1,
    event: 'schedule',
    created_at: '2026-07-15T03:15:00Z',
    updated_at: '2026-07-15T03:18:30Z',
    html_url: 'https://github.com/x/y/actions/runs/1',
  };

  it('calcula la duración de una ejecución completada', () => {
    const run = mapWorkflowRun({ ...base, status: 'completed', conclusion: 'success' });
    expect(run.duration_seconds).toBe(210);
    expect(run.conclusion).toBe('success');
  });

  it('no calcula duración si la ejecución sigue en curso', () => {
    const run = mapWorkflowRun({ ...base, status: 'in_progress', conclusion: null });
    expect(run.duration_seconds).toBeNull();
  });
});

describe('BackupsService', () => {
  let service: BackupsService;
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.GITHUB_BACKUP_TOKEN;
    delete process.env.BACKUP_S3_ENDPOINT;
    delete process.env.BACKUP_S3_ACCESS_KEY_ID;
    delete process.env.BACKUP_S3_SECRET_KEY;
    delete process.env.BACKUP_S3_BUCKET;
    service = new BackupsService();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('getStatus indica no-configurado sin llamar a GitHub cuando falta el token', async () => {
    const spy = jest.spyOn(axios, 'get');
    const status = await service.getStatus();
    expect(status).toEqual({ github_configured: false, s3_configured: false, runs: [] });
    expect(spy).not.toHaveBeenCalled();
  });

  it('getStatus mapea las ejecuciones devueltas por GitHub', async () => {
    process.env.GITHUB_BACKUP_TOKEN = 'tok';
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        workflow_runs: [
          {
            id: 7,
            status: 'completed',
            conclusion: 'success',
            event: 'workflow_dispatch',
            created_at: '2026-07-15T03:15:00Z',
            updated_at: '2026-07-15T03:17:00Z',
            html_url: 'https://github.com/x/y/actions/runs/7',
          },
        ],
      },
    });
    const status = await service.getStatus();
    expect(status.github_configured).toBe(true);
    expect(status.runs).toHaveLength(1);
    expect(status.runs[0]).toMatchObject({ id: 7, conclusion: 'success', duration_seconds: 120 });
  });

  it('triggerBackup falla con 503 si no hay token de GitHub', async () => {
    await expect(service.triggerBackup()).rejects.toThrow(ServiceUnavailableException);
  });

  it('triggerBackup lanza el workflow_dispatch sobre main', async () => {
    process.env.GITHUB_BACKUP_TOKEN = 'tok';
    process.env.GITHUB_BACKUP_REPO = 'acme/repo';
    const spy = jest.spyOn(axios, 'post').mockResolvedValue({ status: 204, data: undefined });
    await expect(service.triggerBackup()).resolves.toEqual({ triggered: true });
    expect(spy).toHaveBeenCalledWith(
      'https://api.github.com/repos/acme/repo/actions/workflows/backup.yml/dispatches',
      { ref: 'main' },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('listBackups devuelve vacío y no-configurado sin credenciales S3', async () => {
    await expect(service.listBackups()).resolves.toEqual({ s3_configured: false, backups: [] });
  });

  it('getDownloadUrl valida la key antes de tocar S3', async () => {
    await expect(service.getDownloadUrl('storage/otro.txt')).rejects.toThrow(BadRequestException);
  });

  it('getDownloadUrl falla con 503 si S3 no está configurado (key válida)', async () => {
    await expect(service.getDownloadUrl('db/db-2026-07-15.dump.gpg')).rejects.toThrow(ServiceUnavailableException);
  });
});
