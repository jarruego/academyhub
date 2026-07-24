import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequest } from "../../../shared/types/course-request/course-request";

/** Alterna "urgente" desde el listado, sin fijar un id_request de antemano (a diferencia de useUpdateCourseRequestMutation). */
export const useToggleCourseRequestUrgentMutation = () => {
  const request = useAuthenticatedAxios<CourseRequest>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id_request, is_urgent }: { id_request: number; is_urgent: boolean }) =>
      (
        await request({
          method: "PUT",
          url: `${getApiHost()}/api/course-requests/${id_request}`,
          data: { is_urgent },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
