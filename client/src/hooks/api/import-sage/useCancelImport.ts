import { useMutation } from '@tanstack/react-query';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

interface CancelImportResponse {
  message: string;
  jobId: string;
}

const cancelImportJob = async (jobId: string, token: string): Promise<CancelImportResponse> => {
  const response = await fetch(`${getApiHost()}/api/import/cancel/${jobId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

export const useCancelImport = () => {
  const { authInfo: { token } } = useAuthInfo();

  return useMutation({
    mutationFn: (jobId: string) => cancelImportJob(jobId, token),
    onError: (error) => {
      console.error('Error cancelando importacion:', error);
    },
  });
};
