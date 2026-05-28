import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { MoodleUserAuthUserLink } from "../../../components/auth-users/types.moodle-link";

export const useMoodleLinksByAuthUser = (authUserId: number | undefined) => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["moodle-links", authUserId],
    queryFn: async (): Promise<MoodleUserAuthUserLink[]> => {
      if (!authUserId) return [];
      const response = await request({
        method: "GET",
        url: `${getApiHost()}/auth/users/${authUserId}/moodle-links`,
      });
      return response.data as MoodleUserAuthUserLink[];
    },
    enabled: !!authUserId,
  });
};
