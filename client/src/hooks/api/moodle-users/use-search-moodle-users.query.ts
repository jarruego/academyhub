import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import type { MoodleUserSelectModel } from "../../../shared/types/moodle/moodle-user.types";

export const useSearchMoodleUsers = (search: string) => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ["search-moodle-users", search],
    queryFn: async (): Promise<MoodleUserSelectModel[]> => {
      if (!search || search.length < 2) return [];
      const response = await request({
        method: "GET",
        url: `${getApiHost()}/moodle-user/search?query=${encodeURIComponent(search)}`,
      });
      return response.data as MoodleUserSelectModel[];
    },
    enabled: !!search && search.length >= 2,
    placeholderData: keepPreviousData,
  });
};
