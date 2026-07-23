import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestDetail } from "../../../shared/types/course-request/course-request";

export const useCourseRequestQuery = (id_request?: string | number) => {
  const request = useAuthenticatedAxios<CourseRequestDetail>();

  return useQuery({
    queryKey: ["course-requests", "detail", id_request],
    queryFn: async () =>
      (
        await request({
          method: "GET",
          url: `${getApiHost()}/api/course-requests/${id_request}`,
        })
      ).data,
    enabled: !!id_request,
  });
};
