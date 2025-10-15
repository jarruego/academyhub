import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { UserCourseWithCourse } from "../../../shared/types/user-course/user-course.types";

export const useUserCoursesQuery = (userId: number) => {
  const request = useAuthenticatedAxios();
  
  return useQuery({
    queryKey: ["user-courses", userId],
    queryFn: async (): Promise<UserCourseWithCourse[]> => {
      const response = await request({
        method: 'GET',
        url: `${getApiHost()}/user/${userId}/courses`,
      });
      return response.data as UserCourseWithCourse[];
    },
    enabled: !!userId,
  });
};