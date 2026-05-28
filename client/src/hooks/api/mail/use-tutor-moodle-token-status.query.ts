import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export function useTutorMoodleTokenStatusQuery(tutorUserId: number | undefined) {
  const request = useAuthenticatedAxios<{ hasToken: boolean }>();

  return useQuery({
    queryKey: ['tutor-moodle-token-status', tutorUserId],
    queryFn: async () => {
      const res = await request({
        method: 'GET',
        url: `${getApiHost()}/mail/tutor-moodle-token-status/${tutorUserId}`,
      });
      return res.data;
    },
    enabled: tutorUserId !== undefined,
    staleTime: 30_000,
  });
}
