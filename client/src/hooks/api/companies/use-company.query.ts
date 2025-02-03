import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Company } from "../../../shared/types/company/company";

export const useCompanyQuery = (id_company: string) => {
    const request = useAuthenticatedAxios<Company>();

    return useQuery({
        queryKey: ['company', id_company],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/company/${id_company}`
        })).data,
    });
};
