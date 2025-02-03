import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Company } from "../../../shared/types/company/company";

export const useUpdateCompanyMutation = (id_company: string) => {
    const request = useAuthenticatedAxios<Company>();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (company: Company) => (await request({
            method: 'PUT',
            url: `${getApiHost()}/company/${id_company}`,
            data: company,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company', id_company] });
        },
    });
};
