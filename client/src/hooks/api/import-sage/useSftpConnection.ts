import { useQuery } from '@tanstack/react-query';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SftpConnectionStatus {
  isConnected: boolean;
  message: string;
  filename?: string;
}

const fetchSftpConnection = async (token: string): Promise<SftpConnectionStatus> => {
  const response = await fetch(`${getApiHost()}/api/import/sftp/check-connection`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check SFTP connection: ${response.statusText}`);
  }

  return response.json();
};

export const useSftpConnection = () => {
  const { authInfo: { token } } = useAuthInfo();

  return useQuery<SftpConnectionStatus, Error>({
    queryKey: ['sftp-connection'],
    queryFn: () => fetchSftpConnection(token),
    // Solo al entrar o volver a la pestaña (sin polling constante)
    refetchOnWindowFocus: true,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
  });
};
