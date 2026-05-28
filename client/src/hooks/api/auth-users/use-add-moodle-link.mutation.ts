import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { MoodleUserAuthUserLink } from "../../../components/auth-users/types.moodle-link";

export const useAddMoodleLink = (authUserId: number | undefined) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id_moodle_user: number; moodle_token: string }) => {
      if (!authUserId) throw new Error("No authUserId");
      const response = await request({
        method: "POST",
        url: `${getApiHost()}/auth/users/${authUserId}/moodle-links`,
        data,
      });
      return response.data as MoodleUserAuthUserLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moodle-links", authUserId] });
    },
  });
};
