import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useRemoveConsultingClientCompanyMutation = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id_company: number) => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/companies/${id_company}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consulting-client-companies', id_consulting_client] });
        },
    });
};
