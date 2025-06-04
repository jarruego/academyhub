import { Button, Table, Input } from "antd";
import { useState, useEffect } from "react";
import { useUsersQuery } from "../../hooks/api/users/use-users.query";
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from "@ant-design/icons"; // Importar los iconos

export default function UsersRoute() {
  const { data: usersData, isLoading: isUsersLoading, isFetching: isUsersRefetching, refetch: refetchUsers } = useUsersQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Usuarios";
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const filteredUsers = usersData?.filter(user => 
    (user.name ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
    (user.first_surname ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
    (user.moodle_username ?? "").toLowerCase().includes(searchText.toLowerCase()) ||
    (user.email ?? "").toLowerCase().includes(searchText.toLowerCase())
  );

  return <div>
    <Input.Search 
      placeholder="Buscar usuarios" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
    />
    <Button onClick={() => navigate('/users/create')} type="primary" icon={<PlusOutlined />}>Añadir Usuario</Button>
    <Table 
      rowKey="id_user" 
      sortDirections={['ascend', 'descend']}
      columns={[
        {
          title: 'ID',
          dataIndex: 'id_user',
          sorter: (a, b) => a.id_user - b.id_user,
        },
        {
          title: 'MOODLE ID',
          dataIndex: 'moodle_id',
          sorter: (a, b) => (a.moodle_id ?? 0) - (b.moodle_id ?? 0),
        },
        {
          title: 'Name',
          dataIndex: 'name',
          sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
          title: 'Apellidos',
          dataIndex: 'first_surname',
          sorter: (a, b) => a.first_surname.localeCompare(b.first_surname),
        },
        {
          title: 'Email',
          dataIndex: 'email',
          sorter: (a, b) => a.email.localeCompare(b.email),
        },
        {
          title: 'MOODLE USERNAME',
          dataIndex: 'moodle_username',
          sorter: (a, b) => (a.moodle_username ?? "").localeCompare(b.moodle_username ?? ""),
        }
      ]} 
      dataSource={filteredUsers} 
      loading={isUsersLoading}
      onRow={(record) => ({
        onDoubleClick: () => navigate(`/users/${record.id_user}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}
