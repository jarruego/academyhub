import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useDeleteCompanyMutation = (id_company: string) => {
    const request = useAuthenticatedAxios();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await request({
            method: 'DELETE',
            url: `${getApiHost()}/company/${id_company}`,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies'] });
        },
    });
};
