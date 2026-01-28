import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface ActiveGroupInfo {
    id_group: number;
    group_name: string;
    moodle_id: number | null;
    end_date: string | null;
}

export interface ActiveCourseProgress {
    id_course: number;
    course_name: string;
    moodle_id: number | null;
    groups: ActiveGroupInfo[];
}

export const useActiveCoursesProgressQuery = () => {
    const request = useAuthenticatedAxios<ActiveCourseProgress[]>();

    return useQuery({
        queryKey: ['moodle', 'active-courses-progress'],
        queryFn: async () => {
            return await request({
                method: 'GET',
                url: `${getApiHost()}/moodle/active-courses-progress`,
            });
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        staleTime: Infinity,
    });
};
