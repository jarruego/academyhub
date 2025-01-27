import { Button } from "antd";
import { useReimportUsersMutation } from "../hooks/api/users/use-reimport-users.mutation";
export default function HomeRoute() {

  return (
    <div>
      <div>Home!</div>
      <ToolList/>
    </div>
  )
}

const ToolList = () => {
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportUsersMutation();
  return <div>
    <Button onClick={() => reimport()} loading={isReimporting}>Reimportar</Button>
  </div>
}