import { useParams } from "react-router-dom";
import UserDetail from "../../components/user/user-detail";

export default function UserDetailRoute() {
  const { id_user = '' } = useParams();

  const userId: number = +id_user;

  if (isNaN(userId)) return <>Error</>;

  return <UserDetail userId={userId}/>
}
