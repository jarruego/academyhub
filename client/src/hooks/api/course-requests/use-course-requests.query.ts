import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequest } from "../../../shared/types/course-request/course-request";
import { CourseRequestStatus } from "../../../shared/types/course-request/course-request-status.enum";

export type CourseRequestFilters = {
  id_course?: number;
  id_center?: number;
  id_company?: number;
  status?: CourseRequestStatus;
};

export const useCourseRequestsQuery = (filters: CourseRequestFilters = {}) => {
  const request = useAuthenticatedAxios<CourseRequest[]>();

  return useQuery({
    queryKey: ["course-requests", filters],
    queryFn: async () =>
      (
        await request({
          method: "GET",
          url: `${getApiHost()}/api/course-requests`,
          params: filters,
        })
      ).data,
  });
};
