import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../../utils/api/get-api-host.util';

export interface LinkUsersRequest {
  bdUserId: number;
  moodleUserId: number;
}

export const useLinkUsersMutation = () => {
  const request = useAuthenticatedAxios<any>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LinkUsersRequest) => {
      const response = await request({
        url: `${getApiHost()}/user-comparison/link`,
        method: 'POST',
        data
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidar el query de comparación para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['user-comparison'] });
    },
  });
};