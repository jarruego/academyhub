import { useState } from "react";
import { AUTH_CONTEXT, AuthContextInfo } from "./auth.context";
import AuthPage from "../../components/auth/auth.page";

type Props = {
    children: React.ReactNode;
}

export default function AuthProvider({children}: Readonly<Props>) {
    const [authInfo, setAuthState] = useState<AuthContextInfo | null>(readUserInfo());

    const setAuth = (authInfo: AuthContextInfo | null) => {
        if (authInfo) writeUserInfo(authInfo);
        else removeUserInfo();
        
        setAuthState(authInfo);
    }

    if (!authInfo) return <AuthPage setInfo={setAuth}/>;

    return <AUTH_CONTEXT.Provider value={{setAuth, authInfo}}>{children}</AUTH_CONTEXT.Provider>
}

const readUserInfo = () => {
    const userInfo = localStorage.getItem("userInfo");
    return userInfo ? JSON.parse(userInfo) : null;
}
const writeUserInfo = (userInfo: AuthContextInfo) => localStorage.setItem("userInfo", JSON.stringify(userInfo));
const removeUserInfo = () => localStorage.removeItem("userInfo");