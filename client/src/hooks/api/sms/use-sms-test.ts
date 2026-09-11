import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { SmsSettingsForm } from '../../../shared/types/sms/sms-settings.types';

export const useTestSmsConnection = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (body: SmsSettingsForm) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/sms/connection`, data: body });
      return data;
    },
  });
};

export interface SendTestSmsRequest {
  to: string;
  message: string;
  senderName?: string;
}

export const useSendTestSms = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (body: SendTestSmsRequest) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/sms/send`, data: body });
      return data;
    },
  });
};
