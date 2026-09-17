import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCentroAction } from "../../../shared/types/consulting-centro/consulting-centro";

export const useConsultingCentroActionsQuery = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingCentroAction[]>();

    return useQuery({
        queryKey: ['consulting-centro-actions', id_annual_engagement],
        enabled: Number.isFinite(id_annual_engagement),
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/actions`,
        })).data,
    });
};
