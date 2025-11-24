import axios, { AxiosRequestConfig } from "axios"
import { useCallback } from 'react';
import { useAuthInfo } from "../../providers/auth/auth.context";

export function useAuthenticatedAxios<D>() {
    const { authInfo: {token}} = useAuthInfo();

    // Memoize the request function so its identity is stable across renders
    // unless the token changes. This prevents effects that depend on it
    // from running unnecessarily.
    return useCallback((options: AxiosRequestConfig<D>) => axios.request<D>({
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    }), [token]);
}