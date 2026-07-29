import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestDetail } from "../../../shared/types/course-request/course-request";

export const useReleaseCourseRequestStudentGroupMutation = (id_request: number) => {
  const request = useAuthenticatedAxios<CourseRequestDetail>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentId: number) =>
      (
        await request({
          method: "PUT",
          url: `${getApiHost()}/api/course-requests/${id_request}/students/${studentId}/release-group`,
        })
      ).data,
    onSuccess: () => {
      // Basta con la clave general: el detalle (["course-requests","detail",id])
      // queda cubierto porque invalidateQueries matchea por prefijo.
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
