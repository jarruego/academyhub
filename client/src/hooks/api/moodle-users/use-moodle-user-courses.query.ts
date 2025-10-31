import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { UserCourseWithCourse } from "../../../shared/types/user-course/user-course.types";

export const useMoodleUserCoursesQuery = (moodleUserId?: number) => {
  const request = useAuthenticatedAxios();

  return useQuery({
    queryKey: ["moodle-user-courses", moodleUserId],
    queryFn: async (): Promise<UserCourseWithCourse[]> => {
      if (!moodleUserId) return [];
      const response = await request({
        method: 'GET',
        url: `${getApiHost()}/moodle-user/${moodleUserId}/courses`,
      });
      return response.data as UserCourseWithCourse[];
    },
    enabled: !!moodleUserId,
  });
};
