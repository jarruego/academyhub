import axios, { AxiosRequestConfig } from "axios"
import { useCallback } from 'react';
import { useConsultingCentroInfo } from "../../providers/consulting-centro/consulting-centro.context";

// Variante de use-authenticated-axios.util.ts para el acceso externo del
// centro: el Bearer sale del token de la URL (contexto propio), no del JWT
// de sesión. Ver docs/consultoria.md.
export function useConsultingCentroAxios<R = unknown, D = unknown>() {
    const { token } = useConsultingCentroInfo();

    return useCallback((options: AxiosRequestConfig<D>) => axios.request<R>({
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    }), [token]);
}
