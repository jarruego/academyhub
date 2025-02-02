import { Button, Table, Input } from "antd";
import { useState } from "react";
import { useUsersQuery } from "../hooks/api/users/use-users.query";
import { useNavigate } from 'react-router-dom';

export default function UsersRoute() {
  const { data: usersData, isLoading: isUsersLoading, isFetching: isUsersRefetching, refetch: refetchUsers } = useUsersQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const filteredUsers = usersData?.filter(user => 
    user.name.toLowerCase().includes(searchText.toLowerCase()) ||
    user.surname.toLowerCase().includes(searchText.toLowerCase()) ||
    user.moodle_username.toLowerCase().includes(searchText.toLowerCase()) ||
    user.email.toLowerCase().includes(searchText.toLowerCase())
  );

  return <div>
    <Input.Search 
      placeholder="Buscar usuarios" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
    />
    <Button onClick={() => navigate('/users/create')} style={{ marginBottom: 16 }}>Añadir Usuario</Button>
    <Button onClick={() => refetchUsers()} loading={isUsersRefetching}>Refrescar</Button>
    <Table rowKey="id_user" columns={[
    {
      title: 'ID',
      dataIndex: 'id_user',
    },
    {
      title: 'MOODLE ID',
      dataIndex: 'moodle_id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
    },
    {
      title: 'Apellidos',
      dataIndex: 'surname',
    },
    {
      title: 'Email',
      dataIndex: 'email',
    },
    {
      title: 'MOODLE USERNAME',
      dataIndex: 'moodle_username',
    },
    {
      title: "Actions",
      render: (_, record) => <Button onClick={() => navigate(`/users/${record.id_user}`)}>Ver</Button>
    }
  ]} dataSource={filteredUsers} loading={isUsersLoading}/>
  </div>
}
