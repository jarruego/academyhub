import { Button } from "antd";
import { useReimportMoodleMutation } from "../../hooks/api/moodle/use-reimport-moodle.mutation";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const ToolList = () => {
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportMoodleMutation();
  return <div>
    <AuthzHide roles={[Role.ADMIN]}>
    <Button onClick={() => reimport()} loading={isReimporting}>Reimportar Datos de la Moodle</Button>
    </AuthzHide>
  </div>;
};

export default ToolList;
