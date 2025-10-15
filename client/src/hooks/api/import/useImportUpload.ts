import { useMutation } from '@tanstack/react-query';
import { UploadResponse } from '../../../types/import.types';
import { useAuthInfo } from '../../../providers/auth/auth.context';

const uploadCSV = async (formData: FormData, token: string): Promise<UploadResponse> => {
    const response = await fetch('/api/import/upload-csv', {
        method: 'POST',
        body: formData,
        headers: {
            'Authorization': `Bearer ${token}`,
            // No agregar Content-Type, el browser lo manejará automáticamente para FormData
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

export const useImportUpload = () => {
    const { authInfo: { token } } = useAuthInfo();
    
    return useMutation({
        mutationFn: (formData: FormData) => uploadCSV(formData, token),
        onError: (error) => {
            console.error('Error uploading CSV:', error);
        },
    });
};