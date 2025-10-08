import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { MoodleGroupListResponse } from "../../../shared/types/moodle-import";

export const useMoodleGroupsByCourseQuery = (moodleCourseId: number, enabled: boolean = true) => {
    const request = useAuthenticatedAxios<MoodleGroupListResponse>();

    return useQuery({
        queryKey: ['moodle', 'groups', moodleCourseId],
        queryFn: async () => {
            return await request({
                method: 'GET',
                url: `${getApiHost()}/moodle/courses/${moodleCourseId}/groups/with-import-status`
            });
        },
        enabled: enabled && !!moodleCourseId,
    });
};