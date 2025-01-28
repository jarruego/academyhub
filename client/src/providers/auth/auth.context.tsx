import { createContext, useContext } from "react";

export interface AuthContextInfo {
    token: string;
    user: object; // TODO: type
}

export const AUTH_CONTEXT = createContext<{setAuth: (info: AuthContextInfo | null) => void, authInfo: AuthContextInfo, logout: () => void}>(null!);

export const useAuthInfo = () => {
    const context = useContext(AUTH_CONTEXT);
    if (!context) {
        throw new Error("useAuthInfo must be used within a AuthProvider");
    }
    return context;
}