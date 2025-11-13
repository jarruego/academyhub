import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ImportResult } from "../../../shared/types/moodle-import";

export const useSyncMoodleGroupMembersMutation = () => {
    const request = useAuthenticatedAxios<ImportResult>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (moodleGroupId: number) => {
            return await request({
                method: 'POST',
                url: `${getApiHost()}/moodle/groups/${moodleGroupId}/sync-members`
            });
        },
        onSuccess: () => {
            // Refresh relevant queries
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });
};
