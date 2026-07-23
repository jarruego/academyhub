import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseRequestStudent, CourseRequestStudentInput } from "../../../shared/types/course-request/course-request";

export const useSaveCourseRequestStudentsMutation = (id_request: number) => {
  const request = useAuthenticatedAxios<CourseRequestStudent[]>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (students: CourseRequestStudentInput[]) =>
      (
        await request({
          method: "PUT",
          url: `${getApiHost()}/api/course-requests/${id_request}/students`,
          data: { students },
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-requests", "detail", id_request] });
      queryClient.invalidateQueries({ queryKey: ["course-requests"] });
    },
  });
};
