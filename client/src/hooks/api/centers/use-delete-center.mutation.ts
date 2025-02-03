import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteCenterMutation = (id_center: string) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await request({
        method: 'DELETE',
        url: `${getApiHost()}/center/${id_center}`,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['centers', 'get-all'] });
    },
  });
};
