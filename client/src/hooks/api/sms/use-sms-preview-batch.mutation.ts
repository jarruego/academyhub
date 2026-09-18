import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SmsPreviewBatchRequest {
  // Exactamente uno de los dos: templateId (plantilla guardada) o message
  // (texto editado ad-hoc, aún sin guardar como plantilla).
  templateId?: number;
  message?: string;
  userIds: number[];
  courseName?: string;
  courseShortName?: string;
  courseStart?: string;
  courseEnd?: string;
}

export interface SmsBatchPreviewResult {
  userId: number;
  // Variables que el mensaje usa pero no tienen valor con el que sustituirlas
  // para este alumno concreto (p.ej. {CLAVE_MOODLE} sin cuenta de Moodle).
  missingVariables: string[];
  length: number;
  parts: number;
  exceedsLimit: boolean;
}

// Comprobación previa para TODOS los destinatarios (a diferencia de
// use-sms-preview-length, que solo comprueba uno) — para avisar de antemano
// de quién tiene un problema antes de lanzar el envío masivo.
export function useSmsPreviewBatchMutation() {
  const request = useAuthenticatedAxios<SmsBatchPreviewResult[]>();

  return useMutation({
    mutationFn: async (data: SmsPreviewBatchRequest) => {
      return (await request({
        method: 'POST',
        url: `${getApiHost()}/sms/preview-batch`,
        data,
      })).data;
    },
  });
}
