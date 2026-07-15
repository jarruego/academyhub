import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

interface DownloadUrlResponse {
  url: string;
  expires_in: number;
}

/** Lanza el workflow de backup en GitHub ("Hacer copia ahora") */
export const useRunBackupMutation = () => {
  const request = useAuthenticatedAxios<{ triggered: boolean }>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await request({ method: 'POST', url: `${getApiHost()}/api/backups/run` });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', 'status'] });
    },
  });
};

/** Pide una URL temporal de descarga para una copia concreta */
export const useDownloadBackupMutation = () => {
  const request = useAuthenticatedAxios<DownloadUrlResponse>();

  return useMutation({
    mutationFn: async (key: string) => {
      const res = await request({ method: 'POST', url: `${getApiHost()}/api/backups/download-url`, data: { key } });
      return res.data;
    },
  });
};
