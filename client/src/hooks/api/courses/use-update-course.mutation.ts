import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Course } from "../../../shared/types/course/course";

export const useUpdateCourseMutation = (id_course: string) => {
    const request = useAuthenticatedAxios<Course>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (course: Course) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/course/${id_course}`,
            data: course,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course', id_course] });
        },
    });
}


