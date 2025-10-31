import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { MoodleUserSelectModel } from "../../../shared/types/moodle/moodle-user.types";

export const useMoodleUsersByUserIdQuery = (userId: number) => {
  const request = useAuthenticatedAxios();

  return useQuery({
    queryKey: ['moodle-users', userId],
    queryFn: async (): Promise<MoodleUserSelectModel[]> => {
      const response = await request({
        method: 'GET',
        url: `${getApiHost()}/moodle-user/by-user/${userId}`,
      });
      return response.data as MoodleUserSelectModel[];
    },
    enabled: !!userId,
  });
};