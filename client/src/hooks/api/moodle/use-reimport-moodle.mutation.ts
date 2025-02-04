import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";

export const useReimportMoodleMutation = () => {
    const request = useAuthenticatedAxios<User[]>();

    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await request({
                method: 'POST',
                url: `${getApiHost()}/course/import-moodle-courses`
            });
            queryClient.refetchQueries({ queryKey: ['users', 'get-all'] });
        },
    });
}