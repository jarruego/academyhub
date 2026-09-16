import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { ConsultingCompetencyTemplateEntry } from "../../../shared/types/consulting-job-position/consulting-job-position";

export const useConsultingCompetencyTemplateQuery = (id_job_position: number | undefined) => {
    const request = useAuthenticatedAxios<ConsultingCompetencyTemplateEntry[]>();

    return useQuery({
        queryKey: ['consulting-competency-template', id_job_position],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/job-positions/${id_job_position}/competency-template`
        })).data,
        enabled: !!id_job_position,
    });
};
