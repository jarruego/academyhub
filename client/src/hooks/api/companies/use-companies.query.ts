import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Company } from "../../../shared/types/company/company";

export const useCompaniesQuery = () => {
    const request = useAuthenticatedAxios<Company[]>();

    return useQuery({
        queryKey: ['companies', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/company`
        })).data,
    });
};
