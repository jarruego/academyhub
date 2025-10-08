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
            // Refrescar las queries relacionadas
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });
};