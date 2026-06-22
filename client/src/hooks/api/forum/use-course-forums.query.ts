import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import { ForumSummary } from '../../../shared/types/forum/forum';

/** Foros de un curso (id LOCAL). Sólo se ejecuta cuando hay courseId. */
export const useCourseForumsQuery = (courseId: number | undefined) => {
  const request = useAuthenticatedAxios<ForumSummary[]>();

  return useQuery({
    queryKey: ['forum', 'course-forums', courseId],
    enabled: courseId != null,
    queryFn: async () =>
      (await request({ method: 'GET', url: `${getApiHost()}/api/forum/courses/${courseId}/forums` })).data,
  });
};
