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
    // Cargar una vez y cachear: nada de refetch automático (cada llamada va a
    // Moodle). El refresco es manual desde el botón "Refrescar".
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () =>
      (await request({ method: 'GET', url: `${getApiHost()}/api/forum/courses/${courseId}/forums` })).data,
  });
};
