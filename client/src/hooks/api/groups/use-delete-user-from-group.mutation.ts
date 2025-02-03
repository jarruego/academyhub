
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

interface DeleteUserFromGroupParams {
  id_group: number;
  id_user: number;
}

export const useDeleteUserFromGroupMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id_group, id_user }: DeleteUserFromGroupParams) => {
      await request({
        method: 'DELETE',
        url: `${getApiHost()}/group/${id_group}/users/${id_user}`,
      });
    },
    onSuccess: (_, { id_group }) => {
      queryClient.refetchQueries({ queryKey: ['users', id_group] });
    },
  });
};