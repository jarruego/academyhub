import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

interface UnenrollUserFromGroupParams {
  id_group: number;
  id_user: number;
}

export const useUnenrollUserFromGroupMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id_group, id_user }: UnenrollUserFromGroupParams) => {
      const response = await request({
        method: 'POST',
        url: `${getApiHost()}/moodle/groups/${id_group}/users/${id_user}/unenroll`,
      });
      return response.data as { success: boolean; message: string };
    },
    onSuccess: (_, { id_user }) => {
      queryClient.invalidateQueries({ queryKey: ['user-courses', id_user] });
    },
  });
};
