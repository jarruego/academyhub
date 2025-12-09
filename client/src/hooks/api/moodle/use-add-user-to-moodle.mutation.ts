import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export const useAddUserToMoodleMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      return await request({ method: 'POST', url: `${getApiHost()}/moodle/users/${userId}/add-to-moodle`, data: {} });
    },
    onSuccess: (_data, vars) => {
      // Invalidate relevant queries so UI updates (moodle users, users list)
      queryClient.invalidateQueries({ queryKey: ['moodle-users', Number((vars as any).userId)] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['moodle'] });
    }
  });
};

export default useAddUserToMoodleMutation;
