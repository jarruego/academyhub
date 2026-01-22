import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProcessedDecision, RevertDecisionRequest } from '../../../types/import.types';
import { useAuthInfo } from '../../../providers/auth/auth.context';
import { getApiHost } from '../../../utils/api/get-api-host.util';

interface ProcessedDecisionsFilters {
    action?: string;
    dateRange?: [string, string];
    search?: string;
}

const fetchProcessedDecisions = async (
    filters?: ProcessedDecisionsFilters,
    token?: string
): Promise<ProcessedDecision[]> => {
    let baseUrl = '/api/import/processed-decisions';
    const params = new URLSearchParams();
    
    if (filters?.action) {
        params.append('action', filters.action);
    }
    
    if (filters?.dateRange && filters.dateRange.length === 2) {
        params.append('startDate', filters.dateRange[0]);
        params.append('endDate', filters.dateRange[1]);
    }
    
    if (filters?.search) {
        params.append('search', filters.search);
    }
    
    if (params.toString()) {
        baseUrl += `?${params.toString()}`;
    }

    const response = await fetch(`${getApiHost()}${baseUrl}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
};

const revertDecision = async (
    decisionId: number, 
    data: RevertDecisionRequest,
    token: string
): Promise<void> => {
    const response = await fetch(`${getApiHost()}/api/import/revert-decision/${decisionId}`, {
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

export const useProcessedDecisions = (filters?: ProcessedDecisionsFilters) => {
    const { authInfo: { token } } = useAuthInfo();
    
    return useQuery({
        queryKey: ['processedDecisions', filters],
        queryFn: () => fetchProcessedDecisions(filters, token),
        retry: 2,
        refetchOnWindowFocus: false,
        staleTime: 0, // Siempre revalidar cuando se invalide
    });
};

export const useRevertDecision = () => {
    const queryClient = useQueryClient();
    const { authInfo: { token } } = useAuthInfo();

    return useMutation({
        mutationFn: ({ decisionId, data }: { decisionId: number; data: RevertDecisionRequest }) =>
            revertDecision(decisionId, data, token),
        onSuccess: () => {
            // Invalidar ambas queries para refrescar las listas
            queryClient.invalidateQueries({ queryKey: ['processedDecisions'] });
            queryClient.invalidateQueries({ queryKey: ['pendingDecisions'] });
        },
        onError: (error) => {
            console.error('Error reverting decision:', error);
        },
    });
};