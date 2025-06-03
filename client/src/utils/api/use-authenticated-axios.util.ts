import axios, { AxiosRequestConfig } from "axios"
import { useAuthInfo } from "../../providers/auth/auth.context";

export function useAuthenticatedAxios<D>() {
    const { authInfo: {token}} = useAuthInfo();
    
    return (options: AxiosRequestConfig<D>) => axios.request<D>({
        headers: {
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
        ...options,
    });
}