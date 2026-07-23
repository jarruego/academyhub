import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import {
  CourseRequestReportFilters,
  CourseRequestReportRow,
} from "../../../shared/types/course-request/course-request-report";

export const useCourseRequestReportQuery = (filters: CourseRequestReportFilters) => {
  const request = useAuthenticatedAxios<CourseRequestReportRow[]>();

  return useQuery({
    queryKey: ["course-requests", "report", filters],
    queryFn: async () =>
      (
        await request({
          method: "GET",
          url: `${getApiHost()}/api/course-requests/report`,
          params: filters,
        })
      ).data,
  });
};
