import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import { GroupWithTutors } from '../../../shared/types/forum/forum';

/** Grupos de un curso (id LOCAL) con sus tutores y disponibilidad de token. */
export const useCourseGroupsWithTutorsQuery = (courseId: number | undefined) => {
  const request = useAuthenticatedAxios<GroupWithTutors[]>();

  return useQuery({
    queryKey: ['forum', 'course-groups-with-tutors', courseId],
    enabled: courseId != null,
    queryFn: async () =>
      (await request({ method: 'GET', url: `${getApiHost()}/api/forum/courses/${courseId}/groups-with-tutors` })).data,
  });
};
