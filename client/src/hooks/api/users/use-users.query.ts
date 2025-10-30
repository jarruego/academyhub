import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";
import { PaginationParams, PaginationResult } from "../../../shared/types/pagination";

// Tipo específico para la respuesta de usuarios paginados
type PaginatedUsersResult = PaginationResult<User>;

export type UsersQueryParams = PaginationParams & { id_company?: string; id_center?: string };

export const useUsersQuery = (params: UsersQueryParams = {}) => {
    const { page = 1, limit = 100, search = "", id_company, id_center } = params;
    const request = useAuthenticatedAxios<PaginatedUsersResult>();

    return useQuery({
        queryKey: ['users', 'paginated', page, limit, search, id_company || null, id_center || null],
        queryFn: async () => {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search }),
                ...(id_company && { id_company }),
                ...(id_center && { id_center }),
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