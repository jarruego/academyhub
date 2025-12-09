import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useCreateUserMutation = () => {
  // Response type is the created User; request body type is Omit<User,'id_user'>
  const request = useAuthenticatedAxios<User, Omit<User, 'id_user'>>();
  const queryClient = useQueryClient();

  return useMutation<User | undefined, unknown, Omit<User, 'id_user'>>({
    mutationFn: async (newUser: Omit<User, 'id_user'>) => {
      const resp = await request({
        method: 'POST',
        url: `${getApiHost()}/user`,
        data: newUser,
      });
      // Return created user object from the API if available
      return resp.data as User | undefined;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['users', 'get-all'] });
    },
  });
};