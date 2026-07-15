import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

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

export interface BackupFile {
  key: string;
  name: string;
  size: number;
  last_modified: string | null;
}

export interface BackupListResponse {
  s3_configured: boolean;
  backups: BackupFile[];
}

export const useBackupStatusQuery = () => {
  const request = useAuthenticatedAxios<BackupStatusResponse>();

  return useQuery({
    queryKey: ['backups', 'status'],
    queryFn: async () => {
      const res = await request({ method: 'GET', url: `${getApiHost()}/api/backups/status` });
      return res.data;
    },
    // Mientras haya una copia en marcha, refrescamos cada 10 s para ver cómo acaba
    refetchInterval: (query) => {
      const runs = query.state.data?.runs ?? [];
      return runs.some((r) => r.status !== 'completed') ? 10_000 : false;
    },
  });
};

export const useBackupListQuery = () => {
  const request = useAuthenticatedAxios<BackupListResponse>();

  return useQuery({
    queryKey: ['backups', 'list'],
    queryFn: async () => {
      const res = await request({ method: 'GET', url: `${getApiHost()}/api/backups/list` });
      return res.data;
    },
  });
};
