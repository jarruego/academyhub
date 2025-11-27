import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const usePushGroupToMoodleMutation = () => {
    // Backend returns an object like: { success: boolean; moodleGroupId?: number; message?: string }
    const request = useAuthenticatedAxios<{ success: boolean; moodleGroupId?: number; message?: string }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (groupId: number) => {
            return await request({
                method: 'POST',
                url: `${getApiHost()}/moodle/groups/${groupId}/push`
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            queryClient.invalidateQueries({ queryKey: ['group'] });
        },
    });
};
