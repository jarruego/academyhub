import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

export const useSftpFileDownload = () => {
  const { authInfo: { token } } = useAuthInfo();

  const downloadFile = async () => {
    try {
      const response = await fetch(`${getApiHost()}/api/import/sftp/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download SFTP file: ${response.statusText}`);
      }

      // Obtener el nombre del archivo del header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'import.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Descargar el archivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      throw error;
    }
  };

  return { downloadFile };
};
