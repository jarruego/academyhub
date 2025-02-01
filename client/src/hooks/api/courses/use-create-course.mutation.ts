import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Course } from "../../../shared/types/course/course";

export const useCreateCourseMutation = () => {
    const request = useAuthenticatedAxios<Course>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (course: Course) => (await request({
            method: 'POST',
            url: `${getApiHost()}/course`,
            data: course,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses', 'get-all'] });
        },
    });
}
