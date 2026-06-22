import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import {
  DuplicateForumRequest,
  PreviewDuplicationResult,
  ExecuteDuplicationResult,
} from '../../../shared/types/forum/forum';

/** Previsualiza la duplicación (no escribe en Moodle). */
export const useForumPreviewMutation = () => {
  const request = useAuthenticatedAxios<PreviewDuplicationResult>();
  return useMutation({
    mutationFn: async (body: DuplicateForumRequest) =>
      (await request({ method: 'POST', url: `${getApiHost()}/api/forum/duplicate/preview`, data: body })).data,
  });
};

/** Ejecuta la duplicación (crea los temas en Moodle). */
export const useForumExecuteMutation = () => {
  const request = useAuthenticatedAxios<ExecuteDuplicationResult>();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: DuplicateForumRequest) =>
      (await request({ method: 'POST', url: `${getApiHost()}/api/forum/duplicate/execute`, data: body })).data,
    onSuccess: () => {
      // Las discusiones cambian: invalidar lo relacionado con foros.
      queryClient.invalidateQueries({ queryKey: ['forum'] });
    },
  });
};
