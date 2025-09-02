import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useUpdateUserMutation = (id_user: number) => {
  const request = useAuthenticatedAxios<User>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: User) => (await request({
      method: 'PUT',
      url: `${getApiHost()}/user/${id_user}`,
      data: user,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id_user] });
    },
  });
}
