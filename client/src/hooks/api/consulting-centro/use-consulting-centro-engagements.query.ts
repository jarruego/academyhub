import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCentroEngagement } from "../../../shared/types/consulting-centro/consulting-centro";

export const useConsultingCentroEngagementsQuery = () => {
    const request = useConsultingCentroAxios<ConsultingCentroEngagement[]>();

    return useQuery({
        queryKey: ['consulting-centro-engagements'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements`,
        })).data,
    });
};
