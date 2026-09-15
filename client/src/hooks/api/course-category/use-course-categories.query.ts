import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { CourseCategory } from "../../../shared/types/course-category/course-category";

export const useCourseCategoriesQuery = () => {
    const request = useAuthenticatedAxios<CourseCategory[]>();

    return useQuery({
        queryKey: ['course-categories', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/api/course-categories`
        })).data,
    });
};
