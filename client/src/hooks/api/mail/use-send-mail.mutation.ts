import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SendMailRequest {
  userId?: number;
  templateId: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
  fromEmail?: string;
  replyTo?: string;
  toEmail: string;
  sendViaMoodle?: boolean;
  authUserId?: number;
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
