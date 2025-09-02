import { createContext, useContext } from "react";
import { UserModel } from "../../hooks/api/auth/use-login.mutation";

export interface AuthContextInfo {
    token: string;
    user: UserModel;
}

export const AUTH_CONTEXT = createContext<{setAuth: (info: AuthContextInfo | null) => void, authInfo: AuthContextInfo, logout: () => void}>(null!);

export const useAuthInfo = () => {
    const context = useContext(AUTH_CONTEXT);
    if (!context) {
        throw new Error("useAuthInfo must be used within a AuthProvider");
    }
    return context;
}