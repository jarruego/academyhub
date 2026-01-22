import { useQuery } from '@tanstack/react-query';
import { JobStatus } from '../../../types/import.types';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

const fetchJobStatus = async (jobId: string, token: string): Promise<JobStatus> => {
    const response = await fetch(`${getApiHost()}/api/import/job-status/${jobId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

export const useJobStatus = (
    jobId: string | null,
    options?: {
        enabled?: boolean;
        refetchInterval?: number | false;
    }
) => {
    const { authInfo: { token } } = useAuthInfo();
    
    return useQuery({
        queryKey: ['jobStatus', jobId],
        queryFn: () => fetchJobStatus(jobId!, token),
        enabled: !!jobId && (options?.enabled ?? true),
        refetchInterval: options?.refetchInterval,
        retry: 3,
        retryDelay: 1000,
    });
};