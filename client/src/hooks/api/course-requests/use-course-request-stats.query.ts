import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestStats } from "../../../shared/types/course-request/course-request";

export const useCourseRequestStatsQuery = () => {
  const request = useAuthenticatedAxios<CourseRequestStats>();

  return useQuery({
    queryKey: ["course-requests", "stats"],
    queryFn: async () =>
      (
        await request({
          method: "GET",
          url: `${getApiHost()}/api/course-requests/stats`,
        })
      ).data,
  });
};
