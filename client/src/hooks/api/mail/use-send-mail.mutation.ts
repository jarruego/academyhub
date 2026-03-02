import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SendMailRequest {
  userId?: number;
  templateId: number;
  fromEmail?: string;
  toEmail: string;
}

export function useSendMailMutation() {
  const request = useAuthenticatedAxios<SendMailRequest>();

  return useMutation({
    mutationFn: async (data: SendMailRequest) => {
      return (await request({
        method: 'POST',
        url: `${getApiHost()}/mail/send-from-template`,
        data,
      })).data;
    },
  });
}
