import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCompetencyRoster } from "../../../shared/types/consulting-competency-evaluation/consulting-competency-evaluation";

export const useConsultingCompetencyRosterQuery = (id_consulting_client: string, id_annual_engagement: string, id_center: string) => {
    const request = useAuthenticatedAxios<ConsultingCompetencyRoster>();

    return useQuery({
        queryKey: ['consulting-competency-roster', id_consulting_client, id_annual_engagement, id_center],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${id_center}/competencies`
        })).data,
        enabled: !!id_annual_engagement && !!id_center,
    });
};
