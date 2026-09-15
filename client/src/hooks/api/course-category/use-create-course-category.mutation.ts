import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseCategory } from "../../../shared/types/course-category/course-category";

export const useCreateCourseCategoryMutation = () => {
    const request = useAuthenticatedAxios<CourseCategory>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (name: string) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/course-categories`,
            data: { name },
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-categories', 'get-all'] });
        },
    });
};
