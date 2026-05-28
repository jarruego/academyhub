import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { MoodleUserAuthUserLink } from "../../../components/auth-users/types.moodle-link";

export const useUpdateMoodleLink = (authUserId: number | undefined) => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { linkId: number; moodle_token: string }) => {
      const { linkId, moodle_token } = data;
      const response = await request({
        method: "PUT",
        url: `${getApiHost()}/auth/users/moodle-links/${linkId}`,
        data: { moodle_token },
      });
      return response.data as MoodleUserAuthUserLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moodle-links", authUserId] });
    },
  });
};
