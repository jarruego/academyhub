import { useQuery } from '@tanstack/react-query';
import { JobInfo } from '../../../types/import.types';
import { useAuthInfo } from '../../../providers/auth/auth.context';

const fetchRecentJobs = async (limit?: number, token?: string): Promise<JobInfo[]> => {
    const url = limit 
        ? `/api/import/jobs?limit=${limit}`
        : '/api/import/jobs';
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

const fetchActiveJobs = async (token: string): Promise<JobInfo[]> => {
    const response = await fetch('/api/import/active-jobs', {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

export const useRecentJobs = (limit?: number) => {
    const { authInfo: { token } } = useAuthInfo();
    
    return useQuery({
        queryKey: ['recentJobs', limit],
        queryFn: () => fetchRecentJobs(limit, token),
        retry: 2,
        refetchOnWindowFocus: false,
    });
};

export const useActiveJobs = () => {
    const { authInfo: { token } } = useAuthInfo();
    
    return useQuery({
        queryKey: ['activeJobs'],
        queryFn: () => fetchActiveJobs(token),
        retry: 2,
        refetchInterval: 5000, // Refrescar cada 5 segundos
    });
};