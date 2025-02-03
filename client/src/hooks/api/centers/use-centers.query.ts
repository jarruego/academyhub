import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Center } from "../../../shared/types/center/center";

export const useCentersQuery = (id_company: string) => {
    const request = useAuthenticatedAxios<Center[]>();

    return useQuery({
        queryKey: ['centers', id_company],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/company/${id_company}/centers`
        })).data,
    });
};
