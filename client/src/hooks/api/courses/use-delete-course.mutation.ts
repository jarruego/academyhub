import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

interface DeleteCourseOptions {
    /** Confirma el borrado en cascada de las matrículas (user_course) del curso. */
    deleteEnrollments?: boolean;
}

export const useDeleteCourseMutation = (id_course: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (options?: DeleteCourseOptions) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/course/${id_course}`,
            params: options?.deleteEnrollments ? { deleteEnrollments: true } : undefined,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
        },
    });
}
