import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SmsTemplate {
  id: number;
  name: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmsTemplateInput {
  name: string;
  message: string;
}

export const useSmsTemplatesQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ['sms-templates'],
    queryFn: async () => {
      const { data } = await request({ method: 'GET', url: `${getApiHost()}/sms-templates` });
      return data as SmsTemplate[];
    },
    refetchOnWindowFocus: false,
  });
};

export const useCreateSmsTemplateMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SmsTemplateInput) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/sms-templates`, data: body });
      return data as SmsTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
    },
  });
};

export const useUpdateSmsTemplateMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Partial<SmsTemplateInput>) => {
      const { data } = await request({ method: 'PUT', url: `${getApiHost()}/sms-templates/${id}`, data: body });
      return data as SmsTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
    },
  });
};

export const useDeleteSmsTemplateMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await request({ method: 'DELETE', url: `${getApiHost()}/sms-templates/${id}` });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-templates'] });
    },
  });
};
