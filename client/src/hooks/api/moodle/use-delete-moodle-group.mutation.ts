import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteMoodleGroupMutation = () => {
    const request = useAuthenticatedAxios<{ success: boolean; moodleGroupId?: number; message?: string }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (groupId: number) => {
            return await request({
                method: 'POST',
                url: `${getApiHost()}/moodle/groups/${groupId}/delete`
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            queryClient.invalidateQueries({ queryKey: ['group'] });
            queryClient.invalidateQueries({ queryKey: ['usersbygroup'] });
        },
    });
};
