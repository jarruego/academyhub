import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ImportResult } from "../../../shared/types/moodle-import";

export const useImportMoodleGroupMutation = () => {
    const request = useAuthenticatedAxios<ImportResult>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (moodleGroupId: number) => {
            return await request({
                method: 'POST',
                url: `${getApiHost()}/moodle/groups/${moodleGroupId}/import`
            });
        },
        onSuccess: () => {
            // Refrescar explícitamente las queries del importador Moodle
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
            queryClient.invalidateQueries({ queryKey: ['moodle', 'courses'] });
            queryClient.invalidateQueries({ queryKey: ['moodle', 'groups'] });
            queryClient.refetchQueries({ queryKey: ['moodle', 'courses'], type: 'active' });
            queryClient.refetchQueries({ queryKey: ['moodle', 'groups'], type: 'active' });

            // Refresco adicional de datos relacionados en otras vistas
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });
};