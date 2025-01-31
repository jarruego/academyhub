import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { Course } from "../../../shared/types/course/course";
import dayjs from "dayjs";

export const useCourseQuery = (id_course: string) => {
    const request = useAuthenticatedAxios<Course>();

    return useQuery({
        queryKey: ['course', id_course],
        queryFn: async () => {
            const data = (await request({
            method: 'GET',
            url: `${getApiHost()}/course/${id_course}`
        })).data;

        return {
            ...data,
            start_date: data.start_date ? dayjs(data.start_date) : undefined,
            end_date: data.end_date ? dayjs(data.end_date) : undefined,
        }
        },
    });
}
