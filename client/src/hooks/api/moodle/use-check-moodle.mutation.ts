import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useCheckMoodleConnection = () => {
    const request = useAuthenticatedAxios<{ success: boolean; info?: unknown; message?: string }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            return await request({ method: 'get', url: `${getApiHost()}/moodle/check` });
        },
        onSuccess: () => {
            // keep queries fresh if needed
            queryClient.invalidateQueries({ queryKey: ['moodle'] });
        }
    });
};
