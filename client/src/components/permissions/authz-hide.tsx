import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";

type Props = {
    roles: Role[];
    children?: React.ReactNode;
}

export const AuthzHide = ({ roles, children }: Props) => {
    const role = useRole();

    if (roles.includes(role)) return children;
    return null;
}