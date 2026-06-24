import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

interface DeleteImportJobResponse {
  message: string;
  jobId: string;
}

const deleteImportJob = async (jobId: string, token: string): Promise<DeleteImportJobResponse> => {
  const response = await fetch(`${getApiHost()}/api/import/jobs/${jobId}`, {
    method: 'DELETE',
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

export const useDeleteImportJob = () => {
  const { authInfo: { token } } = useAuthInfo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) => deleteImportJob(jobId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentJobs'] });
    },
    onError: (error) => {
      console.error('Error eliminando trabajo de importacion:', error);
    },
  });
};
