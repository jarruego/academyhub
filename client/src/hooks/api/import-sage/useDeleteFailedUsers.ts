import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

interface DeleteFailedUsersResponse {
  message: string;
  deleted: number;
}

const deleteAllFailedUsers = async (token: string): Promise<DeleteFailedUsersResponse> => {
  const response = await fetch(`${getApiHost()}/api/import/failed-users`, {
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

export const useDeleteFailedUsers = () => {
  const { authInfo: { token } } = useAuthInfo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllFailedUsers(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failed-users'] });
      queryClient.invalidateQueries({ queryKey: ['failed-users-stats'] });
    },
    onError: (error) => {
      console.error('Error eliminando usuarios fallidos:', error);
    },
  });
};
