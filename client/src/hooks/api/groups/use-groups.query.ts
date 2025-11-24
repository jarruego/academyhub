import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Group } from "../../../shared/types/group/group";

export const useGroupsQuery = (id_course?: string | number) => {
    const request = useAuthenticatedAxios<Group[]>();

    return useQuery({
        queryKey: ['groups', id_course],
        // Only fetch when an id_course is provided. If not, keep the query disabled
        // to avoid making requests to `/course//groups`.
        queryFn: async () => {
            if (!id_course) return [] as Group[];
            const id = String(id_course);
            const res = await request({
                method: 'GET',
                url: `${getApiHost()}/course/${id}/groups`
            });
            return res.data;
        },
        enabled: !!id_course,
    });
}
