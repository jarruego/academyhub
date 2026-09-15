import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingClient } from "../../../shared/types/consulting-client/consulting-client";

export const useCreateConsultingClientMutation = () => {
    const request = useAuthenticatedAxios<Pick<ConsultingClient, 'name'>>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (client: Pick<ConsultingClient, 'name'>) => (await request({
            method: 'POST',
            url: `${getApiHost()}/api/consultoria/clients`,
            data: client,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-clients', 'get-all'] });
        },
    });
};
