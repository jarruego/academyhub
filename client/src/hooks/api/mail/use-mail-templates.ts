import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  content: string;
  is_html: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MailTemplateInput {
  name: string;
  subject: string;
  content: string;
  is_html: boolean;
}

export const useMailTemplatesQuery = () => {
  const request = useAuthenticatedAxios();
  return useQuery({
    queryKey: ['mail-templates'],
    queryFn: async () => {
      const { data } = await request({ method: 'GET', url: `${getApiHost()}/mail-templates` });
      return data as MailTemplate[];
    },
    refetchOnWindowFocus: false,
  });
};

export const useCreateMailTemplateMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MailTemplateInput) => {
      const { data } = await request({ method: 'POST', url: `${getApiHost()}/mail-templates`, data: body });
      return data as MailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-templates'] });
    },
  });
};

export const useUpdateMailTemplateMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number } & Partial<MailTemplateInput>) => {
      const { data } = await request({ method: 'PUT', url: `${getApiHost()}/mail-templates/${id}`, data: body });
      return data as MailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-templates'] });
    },
  });
};

export const useDeleteMailTemplateMutation = () => {
  const request = useAuthenticatedAxios();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await request({ method: 'DELETE', url: `${getApiHost()}/mail-templates/${id}` });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-templates'] });
    },
  });
};
