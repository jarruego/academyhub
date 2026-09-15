import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingClient } from "../../../shared/types/consulting-client/consulting-client";

export const useConsultingClientsQuery = () => {
    const request = useAuthenticatedAxios<ConsultingClient[]>();

    return useQuery({
        queryKey: ['consulting-clients', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients`
        })).data,
    });
};
