import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";
import { PaginationParams, PaginationResult } from "../../../shared/types/pagination";

// Tipo específico para la respuesta de usuarios paginados
type PaginatedUsersResult = PaginationResult<User>;

export const useUsersQuery = (params: PaginationParams = {}) => {
    const { page = 1, limit = 100, search = "" } = params;
    const request = useAuthenticatedAxios<PaginatedUsersResult>();

    return useQuery({
        queryKey: ['users', 'paginated', page, limit, search],
        queryFn: async () => {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search })
            });

            return (await request({
                method: 'GET',
                url: `${getApiHost()}/user?${queryParams.toString()}`
            })).data;
        },
    });
}

// Hook legacy para compatibilidad (sin paginación)
export const useAllUsersQuery = () => {
    const request = useAuthenticatedAxios<User[]>();

    return useQuery({
        queryKey: ['users', 'get-all'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/user/all`
        })).data,
    });
}