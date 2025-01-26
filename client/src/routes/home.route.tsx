import { Button, Table } from "antd";
import { useUsersQuery } from "../hooks/api/users/use-users.query";
import { useReimportUsersMutation } from "../hooks/api/users/use-reimport-users.mutation";

export default function HomeRoute() {
  return (
    <><div>Home!</div>
    <UsersList/></> 
  )
}

const UsersList = () => {
  const { data: usersData, isLoading: isUsersLoading, isFetching: isUsersRefetching, refetch: refetchUsers } = useUsersQuery();
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportUsersMutation();

  return <div>
    <Button onClick={() => refetchUsers()} loading={isUsersRefetching}>Refrescar</Button>
    <Button onClick={() => reimport()} loading={isReimporting}>Reimportar</Button>
    <Table rowKey="id_user" columns={[
    {
      title: 'ID',
      dataIndex: 'id_user',
    },
    {
      title: 'Name',
      dataIndex: 'name',
    },
    {
      title: "Actions",
      render: () => <Button>Editar</Button>
    }
  ]} dataSource={usersData} loading={isUsersLoading}/>

  </div>
}