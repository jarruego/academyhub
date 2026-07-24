import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequest } from "../../../shared/types/course-request/course-request";

export type CreateCourseRequestPayload = {
  id_center?: number;
  id_course: number;
  request_date?: string;
  contact_email?: string;
  notes?: string;
};

export const useCreateCourseRequestMutation = () => {
  const request = useAuthenticatedAxios<CourseRequest>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCourseRequestPayload) =>
      (
        await request({
          method: "POST",
          url: `${getApiHost()}/api/course-requests`,
          data: payload,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
