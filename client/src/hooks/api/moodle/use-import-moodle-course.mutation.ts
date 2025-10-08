import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ImportResult } from "../../../shared/types/moodle-import";

export const useImportMoodleCourseMutation = () => {
    const request = useAuthenticatedAxios<ImportResult>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (moodleCourseId: number) => {
            return await request({
                method: 'POST',
                url: `${getApiHost()}/moodle/courses/${moodleCourseId}/import`
            });
        },
        onSuccess: () => {
            // Refrescar las queries relacionadas
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });
};