import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequest } from "../../../shared/types/course-request/course-request";

export const useReopenCourseRequestMutation = (id_request: number) => {
  const request = useAuthenticatedAxios<CourseRequest>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      (
        await request({
          method: "PUT",
          url: `${getApiHost()}/api/course-requests/${id_request}/reopen`,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
