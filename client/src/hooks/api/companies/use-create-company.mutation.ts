import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Company } from "../../../shared/types/company/company";

export const useCreateCompanyMutation = () => {
    const request = useAuthenticatedAxios<Omit<Company, 'id_company'>>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (company: Omit<Company, 'id_company'>) => (await request({
            method: 'POST',
            url: `${getApiHost()}/company`,
            data: company,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companies', 'get-all'] });
        },
    });
};
