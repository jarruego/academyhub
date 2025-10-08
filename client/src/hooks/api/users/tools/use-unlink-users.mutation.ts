import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../../utils/api/get-api-host.util';

interface UnlinkUsersRequest {
  bdUserId: number;
  moodleUserId: number;
}

interface UnlinkUsersResponse {
  message: string;
  success: boolean;
}

export const useUnlinkUsersMutation = () => {
  const queryClient = useQueryClient();
  const request = useAuthenticatedAxios();

  return useMutation<UnlinkUsersResponse, Error, UnlinkUsersRequest>({
    mutationFn: async ({ bdUserId, moodleUserId }) => {
      const response = await request({
        url: `${getApiHost()}/user-comparison/unlink`,
        method: 'POST',
        data: { bdUserId, moodleUserId }
      });
      return response.data as UnlinkUsersResponse;
    },
    onSuccess: () => {
      // Invalidar la caché para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['user-comparison'] });
    }
  });
};