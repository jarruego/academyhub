import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { User } from "../../../shared/types/user/user";
import { PaginationParams, PaginationResult } from "../../../shared/types/pagination";

// Tipo específico para la respuesta de usuarios paginados
type PaginatedUsersResult = PaginationResult<User>;

export type FormationType = 'fundae' | 'inaem' | 'privada';

export type UsersQueryParams = PaginationParams & { id_company?: string; id_center?: string; preinscribed?: boolean; formation_type?: FormationType; includeInactive?: boolean; mainCenterOnly?: boolean };

export const useUsersQuery = (params: UsersQueryParams = {}) => {
    const { page = 1, limit = 100, search = "", id_company, id_center, preinscribed, formation_type, includeInactive = true, mainCenterOnly = false } = params;
    const request = useAuthenticatedAxios<PaginatedUsersResult>();

    return useQuery({
        queryKey: ['users', 'paginated', page, limit, search, id_company || null, id_center || null, preinscribed || false, formation_type || null, includeInactive, mainCenterOnly],
        queryFn: async () => {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search }),
                ...(id_company && { id_company }),
                ...(id_center && { id_center }),
                ...(preinscribed && { preinscribed: 'true' }),
                ...(formation_type && { formation_type }),
                // Sólo se envía para ocultar las bajas; por defecto se muestran todos.
                ...(includeInactive === false && { include_inactive: 'false' }),
                // Junto con id_center, restringe a quienes lo tienen como centro principal.
                ...(mainCenterOnly && id_center && { main_center_only: 'true' }),
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

// Hook rápido para devolver solo campos mínimos necesarios para lookup (dni, nombre, apellidos)
export const useAllUsersLookupQuery = () => {
    const request = useAuthenticatedAxios<Array<Pick<User, 'id_user' | 'dni' | 'name' | 'first_surname' | 'second_surname'>>>();

    return useQuery({
        queryKey: ['users', 'lookup'],
        queryFn: async () => (await request({
            method: 'GET',
            url: `${getApiHost()}/user/lookup`
        })).data,
    });
}