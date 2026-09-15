import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingClient } from "../../../shared/types/consulting-client/consulting-client";

export const useUpdateConsultingClientMutation = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios<Pick<ConsultingClient, 'name'>>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (client: Pick<ConsultingClient, 'name'>) => (await request({
            method: 'PATCH',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}`,
            data: client,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-client', id_consulting_client] });
            queryClient.invalidateQueries({ queryKey: ['consulting-clients', 'get-all'] });
        },
    });
};
