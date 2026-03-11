
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useBulkCreateAndAddToGroupMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ users, id_group }: { users: Omit<User, 'id_user'>[], id_group: number }) => {
      const response = await request({
        method: 'POST',
        url: `${getApiHost()}/user/bulk-create-and-add-to-group/${id_group}`,
        data: users,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['usersbygroup'] });
      queryClient.refetchQueries({ queryKey: ['users', 'lookup'] });
    },
  });
};