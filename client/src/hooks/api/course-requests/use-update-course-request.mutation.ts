import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequest } from "../../../shared/types/course-request/course-request";

export type UpdateCourseRequestPayload = {
  id_center?: number | null;
  id_course?: number;
  request_date?: string;
  contact_email?: string | null;
  notes?: string | null;
};

export const useUpdateCourseRequestMutation = (id_request: number) => {
  const request = useAuthenticatedAxios<CourseRequest>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateCourseRequestPayload) =>
      (
        await request({
          method: "PUT",
          url: `${getApiHost()}/api/course-requests/${id_request}`,
          data: payload,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
