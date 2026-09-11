import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { SmsLogRow } from './use-sms-log.query';

export const useRefreshSmsLogStatusMutation = () => {
  const request = useAuthenticatedAxios<SmsLogRow>();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/sms-log/${id}/refresh-status` });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-log'] });
    },
  });
};
