import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from 'antd';
import BackupsPanel, { formatDuration, formatSize } from './BackupsPanel';

vi.mock('../../utils/permissions/use-role', () => ({
  useRole: () => 'admin',
}));
vi.mock('../../hooks/api/backups/use-backups.query', () => ({
  useBackupStatusQuery: () => ({
    data: {
      github_configured: true,
      s3_configured: true,
      runs: [
        {
          id: 2,
          status: 'completed',
          conclusion: 'success',
          event: 'schedule',
          created_at: '2026-07-15T03:15:00Z',
          updated_at: '2026-07-15T03:17:00Z',
          duration_seconds: 120,
          html_url: 'https://github.com/x/y/actions/runs/2',
        },
        {
          id: 1,
          status: 'completed',
          conclusion: 'failure',
          event: 'workflow_dispatch',
          created_at: '2026-07-14T10:00:00Z',
          updated_at: '2026-07-14T10:01:00Z',
          duration_seconds: 60,
          html_url: 'https://github.com/x/y/actions/runs/1',
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useBackupListQuery: () => ({
    data: {
      s3_configured: true,
      backups: [{ key: 'db/db-2026-07-15.dump.gpg', name: 'db-2026-07-15.dump.gpg', size: 5_082_629, last_modified: '2026-07-15T03:17:00Z' }],
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('../../hooks/api/backups/use-backups.mutation', () => ({
  useRunBackupMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDownloadBackupMutation: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));

describe('<BackupsPanel/>', () => {
  it('muestra las ejecuciones, las copias y las acciones principales', async () => {
    cleanup();
    render(
      <App>
        <BackupsPanel />
      </App>,
    );

    expect(await screen.findByText('Copias de seguridad')).toBeDefined();
    // Última ejecución correcta + una fallida en el histórico
    expect(screen.getByText('Correcta')).toBeDefined();
    expect(screen.getByText('Fallida')).toBeDefined();
    // Sin alerta de fallo porque la ejecución más reciente fue correcta
    expect(screen.queryByText('La última copia falló')).toBeNull();
    // Copia listada con su botón de descarga
    expect(screen.getByText('db-2026-07-15.dump.gpg')).toBeDefined();
    expect(screen.getByText('Descargar')).toBeDefined();
    expect(screen.getByText('Hacer copia ahora')).toBeDefined();
    // Sección de ayuda plegable al pie
    expect(screen.getByText('¿Qué es esta copia de seguridad?')).toBeDefined();
    expect(screen.getByText('Cómo restaurar una copia manualmente')).toBeDefined();
  });
});

describe('helpers de formato', () => {
  it('formatSize muestra MB y GB', () => {
    expect(formatSize(5_082_629)).toBe('4.8 MB');
    expect(formatSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });

  it('formatDuration muestra minutos y segundos', () => {
    expect(formatDuration(210)).toBe('3 min 30 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(null)).toBe('—');
  });
});
