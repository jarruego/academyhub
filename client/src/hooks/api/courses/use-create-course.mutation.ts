import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Course } from "../../../shared/types/course/course";

export const useCreateCourseMutation = () => {
    const request = useAuthenticatedAxios<Omit<Course, 'id_course'>>();
    const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newCourse: Omit<Course, 'id_course'>) => {
      await request({
        method: 'POST',
        url: `${getApiHost()}/course`,
        data: newCourse,
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['courses', 'get-all'] });
    },
  });
};