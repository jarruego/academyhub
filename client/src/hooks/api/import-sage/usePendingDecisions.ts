import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PendingDecision, ProcessDecisionRequest } from '../../../types/import.types';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

const fetchPendingDecisions = async (source?: string, token?: string): Promise<PendingDecision[]> => {
    const url = source 
        ? `${getApiHost()}/api/import/pending-decisions?source=${encodeURIComponent(source)}`
        : `${getApiHost()}/api/import/pending-decisions`;
    
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

const processDecision = async (
    decisionId: number, 
    data: ProcessDecisionRequest,
    token: string
): Promise<void> => {
    const response = await fetch(`${getApiHost()}/api/import/process-decision/${decisionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

export const usePendingDecisions = (source?: string) => {
    const { authInfo: { token } } = useAuthInfo();
    
    return useQuery({
        queryKey: ['pendingDecisions', source],
        queryFn: () => fetchPendingDecisions(source, token),
        retry: 2,
        refetchOnWindowFocus: false,
        staleTime: 0, // Siempre revalidar cuando se invalide
    });
};

export const useProcessDecision = () => {
    const queryClient = useQueryClient();
    const { authInfo: { token } } = useAuthInfo();

    return useMutation({
        mutationFn: ({ decisionId, data }: { decisionId: number; data: ProcessDecisionRequest }) =>
            processDecision(decisionId, data, token),
        onSuccess: () => {
            // Invalidar ambas queries para refrescar las listas
            queryClient.invalidateQueries({ queryKey: ['pendingDecisions'] });
            queryClient.invalidateQueries({ queryKey: ['processedDecisions'] });
        },
        onError: (error) => {
            console.error('Error processing decision:', error);
        },
    });
};