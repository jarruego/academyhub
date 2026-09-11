import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SendSmsFromTemplateRequest {
  userId?: number;
  templateId: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
  toPhone: string;
  senderName?: string;
}

export function useSendSmsMutation() {
  const request = useAuthenticatedAxios<SendSmsFromTemplateRequest>();

  return useMutation({
    mutationFn: async (data: SendSmsFromTemplateRequest) => {
      return (await request({
        method: 'POST',
        url: `${getApiHost()}/sms/send-from-template`,
        data,
      })).data;
    },
  });
}
