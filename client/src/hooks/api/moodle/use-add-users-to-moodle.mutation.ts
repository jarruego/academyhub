import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useAddUsersToMoodleMutation = () => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ groupId, userIds }: { groupId: number; userIds: number[] }) => {
            return await request({
                method: 'POST',
                url: `${getApiHost()}/moodle/groups/${groupId}/add-members`,
                data: { userIds }
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
