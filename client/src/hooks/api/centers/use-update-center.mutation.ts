import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useUpdateCenterMutation = (id_center: string) => {
  const request = useAuthenticatedAxios<Center>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updatedCenter: Center) => {
      await request({
        method: 'PUT',
        url: `${getApiHost()}/center/${id_center}`,
        data: updatedCenter,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['center', id_center] });
    },
  });
};
