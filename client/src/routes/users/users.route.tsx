import { Button, Table, Input } from "antd";
import { useState, useEffect } from "react";
import { useUsersQuery } from "../../hooks/api/users/use-users.query";
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from "@ant-design/icons"; 
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

export default function UsersRoute() {
  const { data: usersData, isLoading: isUsersLoading } = useUsersQuery();
  const [searchText, setSearchText] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Usuarios";
  }, []);

  const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const normalizedSearch = normalize(searchText);

  const filteredUsers = usersData?.filter(user => 
    normalize(user.name ?? '').includes(normalizedSearch) ||
    normalize(user.first_surname ?? '').includes(normalizedSearch) ||
    normalize(user.moodle_username ?? '').includes(normalizedSearch) ||
    normalize(user.email ?? '').includes(normalizedSearch) ||
    normalize(user.dni ?? '').includes(normalizedSearch) ||
    normalize(user.centers?.find(c => c.is_main_center)?.center_name ?? user.centers?.[0]?.center_name ?? '').includes(normalizedSearch) ||
    normalize(user.centers?.find(c => c.is_main_center)?.company_name ?? user.centers?.[0]?.company_name ?? '').includes(normalizedSearch)
  );

  return <div>
    <Input.Search 
      placeholder="Buscar usuarios" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
    />
    <AuthzHide roles={[Role.ADMIN]}><Button onClick={() => navigate('/users/create')} type="primary" icon={<PlusOutlined />}>Añadir Usuario</Button></AuthzHide>
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
          title: 'DNI',
          dataIndex: 'dni',
          sorter: (a, b) => (a.dni ?? '').localeCompare(b.dni ?? ''),
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
        },
        {
          title: 'Centro',
          render: (_, user) => (user.centers?.find(c => c.is_main_center)?.center_name ?? user.centers?.[0]?.center_name ?? '-'),
          sorter: (a, b) => {
            const ca = a.centers?.find(c => c.is_main_center)?.center_name ?? a.centers?.[0]?.center_name ?? '';
            const cb = b.centers?.find(c => c.is_main_center)?.center_name ?? b.centers?.[0]?.center_name ?? '';
            return ca.localeCompare(cb);
          },
        },
        {
          title: 'Empresa',
          render: (_, user) => (user.centers?.find(c => c.is_main_center)?.company_name ?? user.centers?.[0]?.company_name ?? '-'),
          sorter: (a, b) => {
            const ca = a.centers?.find(c => c.is_main_center)?.company_name ?? a.centers?.[0]?.company_name ?? '';
            const cb = b.centers?.find(c => c.is_main_center)?.company_name ?? b.centers?.[0]?.company_name ?? '';
            return ca.localeCompare(cb);
          },
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
