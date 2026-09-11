import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { SmsSettingsForm } from '../../../shared/types/sms/sms-settings.types';

export const useSmsSettingsQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ['sms-settings'],
    queryFn: async () => {
      const { data } = await request({ method: 'GET', url: `${getApiHost()}/sms-settings` });
      return data;
    },
    refetchOnWindowFocus: false,
  });
};

export const useSaveSmsSettingsMutation = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (body: SmsSettingsForm) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/sms-settings`, data: body });
      return data;
    },
  });
};
