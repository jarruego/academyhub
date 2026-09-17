import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRevokeConsultingCenterTokenMutation = (id_center: number) => {
    const request = useAuthenticatedAxios<{ success: boolean }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/centers/${id_center}/token`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-center-token', id_center] });
        },
    });
};
