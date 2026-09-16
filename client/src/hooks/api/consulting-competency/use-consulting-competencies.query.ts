import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCompetency } from "../../../shared/types/consulting-competency/consulting-competency";

export const useConsultingCompetenciesQuery = () => {
    const request = useAuthenticatedAxios<ConsultingCompetency[]>();

    return useQuery({
        queryKey: ['consulting-competencies', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/competencies`
        })).data,
    });
};
