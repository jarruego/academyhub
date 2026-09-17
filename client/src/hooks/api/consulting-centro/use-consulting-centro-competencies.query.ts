import { useQuery } from "@tanstack/react-query";
import { useConsultingCentroAxios } from "../../../utils/api/use-consulting-centro-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCompetencyRoster } from "../../../shared/types/consulting-competency-evaluation/consulting-competency-evaluation";

export const useConsultingCentroCompetenciesQuery = (id_annual_engagement: number) => {
    const request = useConsultingCentroAxios<ConsultingCompetencyRoster>();

    return useQuery({
        queryKey: ['consulting-centro-competencies', id_annual_engagement],
        enabled: Number.isFinite(id_annual_engagement),
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/centro/engagements/${id_annual_engagement}/competencies`,
        })).data,
    });
};
