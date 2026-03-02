import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export const useTestSmtpConnection = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/mail/connection`, data: body });
      return data;
    },
  });
};

export const useSendTestMail = () => {
  const request = useAuthenticatedAxios();
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/mail/send`, data: body });
      return data;
    },
  });
};
