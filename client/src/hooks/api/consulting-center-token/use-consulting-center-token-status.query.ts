import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCenterTokenStatus } from "../../../shared/types/consulting-center-token/consulting-center-token";

export const useConsultingCenterTokenStatusQuery = (id_center: number) => {
    const request = useAuthenticatedAxios<ConsultingCenterTokenStatus>();

    return useQuery({
        queryKey: ['consulting-center-token', id_center],
        enabled: Number.isFinite(id_center),
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centers/${id_center}/token`,
        })).data,
    });
};
