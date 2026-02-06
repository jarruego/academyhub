import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useUnlinkMoodleUserMutation = (userId?: number) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (moodleUserId: number) => {
      const response = await request({
        method: 'DELETE',
        url: `${getApiHost()}/moodle-user/unlink/${moodleUserId}`,
      });
      return response.data;
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['moodle-users', userId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['moodle-users'] });
      }
    }
  });

  return mutation;
};
