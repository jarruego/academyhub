import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestDetail } from "../../../shared/types/course-request/course-request";

type AssignStudentsGroupInput = {
  id_request: number;
  id_group: number;
  studentIds: number[];
};

export const useAssignCourseRequestStudentsGroupMutation = () => {
  const request = useAuthenticatedAxios<CourseRequestDetail>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id_request, id_group, studentIds }: AssignStudentsGroupInput) =>
      (
        await request({
          method: "PUT",
          url: `${getApiHost()}/api/course-requests/${id_request}/students/assign-group`,
          data: { id_group, studentIds },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
