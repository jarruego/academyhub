
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteGroupMutation = (id_group: string) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await request({
        method: 'DELETE',
        url: `${getApiHost()}/group/${id_group}`,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['groups', 'get-all'] });
    },
  });
};