import { useAuthInfo } from "../../providers/auth/auth.context";


export const useRole = () => {
    const { authInfo: { user: { role }} } = useAuthInfo();
    return role;
}