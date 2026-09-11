import { useMutation } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export interface SmsPreviewLengthRequest {
  // Exactamente uno de los dos: templateId (plantilla guardada) o message
  // (texto editado ad-hoc, aún sin guardar como plantilla).
  templateId?: number;
  message?: string;
  userId?: number;
  courseName?: string;
  courseStart?: string;
  courseEnd?: string;
}

export interface SmsPreviewLengthResponse {
  length: number;
  parts: number;
  encoding: 'GSM-7' | 'UCS-2';
  limitParts: number;
}

export function useSmsPreviewLengthMutation() {
  const request = useAuthenticatedAxios<SmsPreviewLengthResponse>();

  return useMutation({
    mutationFn: async (data: SmsPreviewLengthRequest) => {
      return (await request({
        method: 'POST',
        url: `${getApiHost()}/sms/preview-length`,
        data,
      })).data;
    },
  });
}
