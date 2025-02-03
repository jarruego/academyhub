import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useCreateUserMutation = () => {
  const request = useAuthenticatedAxios<Omit<User, 'id_user'>>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUser: Omit<User, 'id_user'>) => {
      await request({
        method: 'POST',
        url: `${getApiHost()}/user`,
        data: newUser,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['users', 'get-all'] });
    },
  });
};