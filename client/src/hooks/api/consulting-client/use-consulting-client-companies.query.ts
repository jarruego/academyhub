import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingClientCompany } from "../../../shared/types/consulting-client/consulting-client-company";

export const useConsultingClientCompaniesQuery = (id_consulting_client: string) => {
    const request = useAuthenticatedAxios<ConsultingClientCompany[]>();

    return useQuery({
        queryKey: ['consulting-client-companies', id_consulting_client],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/companies`
        })).data,
    });
};
