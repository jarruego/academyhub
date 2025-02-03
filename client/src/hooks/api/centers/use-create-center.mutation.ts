import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useCreateCenterMutation = () => {
  const request = useAuthenticatedAxios<Omit<Center, 'id_center'>>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCenter: Omit<Center, 'id_center'>) => {
      await request({
        method: 'POST',
        url: `${getApiHost()}/center`,
        data: newCenter,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['centers'] });
    },
  });
};
