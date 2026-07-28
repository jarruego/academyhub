import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestDetail } from "../../../shared/types/course-request/course-request";

/** Duplica una petición (cabecera + alumnos) como una nueva petición ABIERTA. */
export const useDuplicateCourseRequestMutation = () => {
  const request = useAuthenticatedAxios<CourseRequestDetail>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id_request: number) =>
      (
        await request({
          method: "POST",
          url: `${getApiHost()}/api/course-requests/${id_request}/duplicate`,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
