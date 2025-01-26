import { useState } from "react";
import { AUTH_CONTEXT, AuthContextInfo } from "./auth.context";
import AuthPage from "../../components/auth/auth.page";

type Props = {
    children: React.ReactNode;
}

export default function AuthProvider({children}: Readonly<Props>) {
    const [authInfo, setAuth] = useState<AuthContextInfo | null>(null);

    if (!authInfo) return <AuthPage setInfo={setAuth}/>;

    return <AUTH_CONTEXT.Provider value={{setAuth, authInfo}}>{children}</AUTH_CONTEXT.Provider>
}