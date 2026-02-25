import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export const useSmtpSettingsQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ['smtp-settings'],
    queryFn: async () => {
      const { data } = await request({ method: 'GET', url: `${getApiHost()}/smtp-settings` });
      return data;
    },
    refetchOnWindowFocus: false,
  });
};

export const useSaveSmtpSettingsMutation = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/smtp-settings`, data: body });
      return data;
    },
  });
};
