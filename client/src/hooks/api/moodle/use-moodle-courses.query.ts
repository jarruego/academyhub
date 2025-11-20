import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { MoodleCourseListResponse } from "../../../shared/types/moodle-import";

export const useMoodleCoursesQuery = () => {
    const request = useAuthenticatedAxios<MoodleCourseListResponse>();

    return useQuery({
        queryKey: ['moodle', 'courses'],
        queryFn: async () => {
            return await request({
                method: 'GET',
                url: `${getApiHost()}/moodle/courses/with-import-status`
            });
        },
        // Disable automatic refetching: only refetch when user explicitly calls refetch()
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        // Treat data as fresh indefinitely so React Query won't try to automatically revalidate
        staleTime: Infinity,
    });
};