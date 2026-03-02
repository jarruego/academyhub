import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SendCustomMailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
}

export function useSendCustomMailMutation() {
  const request = useAuthenticatedAxios<SendCustomMailRequest>();

  return useMutation({
    mutationFn: async (data: SendCustomMailRequest) => {
      return (await request({
        method: 'POST',
        url: `${getApiHost()}/mail/send`,
        data,
      })).data;
    },
  });
}