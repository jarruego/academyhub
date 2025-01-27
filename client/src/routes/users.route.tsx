import { Button, Table, Input } from "antd";
import { useState } from "react";
import { useUsersQuery } from "../hooks/api/users/use-users.query";

export default function UsersRoute() {
  const { data: usersData, isLoading: isUsersLoading, isFetching: isUsersRefetching, refetch: refetchUsers } = useUsersQuery();
  const [searchText, setSearchText] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const filteredUsers = usersData?.filter(user => 
    user.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return <div>
    <Input.Search 
      placeholder="Buscar usuarios" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
    />
    <Button onClick={() => refetchUsers()} loading={isUsersRefetching}>Refrescar</Button>
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
      render: () => <Button>Ver</Button>
    }
  ]} dataSource={filteredUsers} loading={isUsersLoading}/>
  </div>
}
