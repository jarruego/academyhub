import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useAddUserToGroupMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id_group, id_user }: { id_group: number, id_user: number }) => {
      await request({
        method: 'POST',
        url: `${getApiHost()}/group/${id_group}/users/${id_user}`,
        data: { id_user },
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['usersbygroup'] });
    },
  });
}