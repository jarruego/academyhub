import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SendCustomSmsRequest {
  to: string;
  message: string;
  senderName?: string;
  applyVariables?: boolean;
  userId?: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
}

export function useSendCustomSmsMutation() {
  const request = useAuthenticatedAxios<SendCustomSmsRequest>();

  return useMutation({
    mutationFn: async (data: SendCustomSmsRequest) => {
      return (await request({
        method: 'POST',
        url: `${getApiHost()}/sms/send`,
        data,
      })).data;
    },
  });
}
