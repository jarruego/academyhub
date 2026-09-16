import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export const useConsultingJobPositionAliasesUnmappedQuery = () => {
    const request = useAuthenticatedAxios<string[]>();

    return useQuery({
        queryKey: ['consulting-job-position-aliases', 'unmapped'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/consultoria/job-position-aliases/unmapped`
        })).data,
    });
};
