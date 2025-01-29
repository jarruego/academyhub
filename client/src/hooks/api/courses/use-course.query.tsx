import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Course } from "../../../shared/types/course/course";

export const useCourseQuery = (id_course: string) => {
    const request = useAuthenticatedAxios<Course>();

    return useQuery({
        queryKey: ['course', id_course],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/course/${id_course}`
        })).data,
    });
}
