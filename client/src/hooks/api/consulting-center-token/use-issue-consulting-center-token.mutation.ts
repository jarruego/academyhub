import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

// Genera o regenera el token — el plano se devuelve una única vez, no se
// puede recuperar después (solo se guarda su hash). Ver docs/consultoria.md.
export const useIssueConsultingCenterTokenMutation = (id_center: number) => {
    const request = useAuthenticatedAxios<{ token: string }>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/centers/${id_center}/token`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-center-token', id_center] });
        },
    });
};
