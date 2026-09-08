import { useAuthInfo } from "../../providers/auth/auth.context";


export const useRole = () => {
    const { authInfo: { user: { role }} } = useAuthInfo();
    return role;
}

// Permiso puntual, independiente del rol — ver auth_users.can_manage_candidates.
export const useCanManageCandidates = () => {
    const { authInfo: { user } } = useAuthInfo();
    return Boolean(user.can_manage_candidates);
}