import { useMutation } from '@tanstack/react-query';
import { UploadResponse } from '../../../types/import.types';
import { useAuthInfo } from '../../../providers/auth/auth.context';

interface FtpPayload {
  path?: string;
}

const startImportFromFtp = async (payload: FtpPayload, token: string): Promise<UploadResponse> => {
  const response = await fetch('/api/import/upload-csv-ftp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload || {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

export const useImportUploadFtp = () => {
  const { authInfo: { token } } = useAuthInfo();

  return useMutation({
    mutationFn: (payload: FtpPayload) => startImportFromFtp(payload, token),
    onError: (error) => {
      console.error('Error iniciando importación desde FTP:', error);
    },
  });
};
