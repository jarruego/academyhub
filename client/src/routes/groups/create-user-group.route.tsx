import { useParams, useNavigate } from "react-router-dom";
import { Button, message, Table, Input } from "antd";
import { useUsersQuery } from "../../hooks/api/users/use-users.query";
import { useAddUserToGroupMutation } from "../../hooks/api/groups/use-add-user-to-group.mutation";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { useDeleteUserFromGroupMutation } from "../../hooks/api/groups/use-delete-user-from-group.mutation";
import { useState, useEffect } from "react";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

export default function CreateUserGroupRoute() {
  const { id_group } = useParams();
  const navigate = useNavigate();
  const { data: usersData, isLoading: isUsersLoading } = useUsersQuery();
  const { mutateAsync: addUserToGroup } = useAddUserToGroupMutation();
  const { data: groupUsersData, isLoading: isGroupUsersLoading, refetch: refetchUsers } = useUsersByGroupQuery(id_group ? parseInt(id_group, 10) : null);
  const { mutateAsync: deleteUserFromGroup } = useDeleteUserFromGroupMutation();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    document.title = "Añadir Usuarios al Grupo";
  }, []);

  const handleSaveUsers = async () => {
    if (!id_group || selectedUserIds.length === 0) return;
    try {
      await Promise.all(selectedUserIds.map(id_user => addUserToGroup({ id_group: parseInt(id_group, 10), id_user })));
      message.success('Usuarios añadidos exitosamente');
      navigate(`/groups/${id_group}/add-user`);
    } catch {
      message.error('No se pudo añadir a los usuarios');
    }
  };

  const handleDeleteUsers = async () => {
    if (!id_group || selectedGroupUserIds.length === 0) return;
    try {
      await Promise.all(selectedGroupUserIds.map(id_user => deleteUserFromGroup({ id_group: parseInt(id_group, 10), id_user })));
      message.success('Usuarios eliminados exitosamente');
      setSelectedGroupUserIds([]);
      await refetchUsers(); // Refrescar los datos de los usuarios
    } catch {
      message.error('No se pudo eliminar a los usuarios');
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedUserIds(selectedRowKeys as number[]);
    },
  };

  const groupUserRowSelection = {
    selectedRowKeys: selectedGroupUserIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedGroupUserIds(selectedRowKeys as number[]);
    },
  };

  const filteredUsersData = usersData
    ?.filter(user => !groupUsersData?.some(groupUser => groupUser.id_user === user.id_user))
    .filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div>
      <h2>Todos los Usuarios</h2>
      <Input
        placeholder="Buscar usuarios"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      <AuthzHide roles={[Role.ADMIN]}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleSaveUsers}>
          Añadir al Grupo
        </Button>
      </AuthzHide>
      <Table
        rowKey="id_user"
        columns={[
          { title: 'ID', dataIndex: 'id_user' },
          { title: 'Nombre', dataIndex: 'name' },
          { title: 'Apellidos', dataIndex: 'surname' },
          { title: 'Email', dataIndex: 'email' },
        ]}
        dataSource={filteredUsersData}
        loading={isUsersLoading}
        rowSelection={rowSelection}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/users/${record.id_user}`, { state: { from: location.pathname } }),
          style: { cursor: 'pointer' }
        })}
      />
      <h2>Usuarios del Grupo</h2>
      <AuthzHide roles={[Role.ADMIN]}>
        <Button type="primary" danger onClick={handleDeleteUsers} style={{ marginTop: '16px' }} icon={<DeleteOutlined />}>
          Eliminar del Grupo
        </Button>
      </AuthzHide>
      <Table
        rowKey="id_user"
        columns={[
          { title: 'ID', dataIndex: 'id_user' },
          { title: 'Nombre', dataIndex: 'name' },
          { title: 'Apellidos', dataIndex: 'surname' },
          { title: 'Email', dataIndex: 'email' },
        ]}
        dataSource={groupUsersData}
        loading={isGroupUsersLoading}
        rowSelection={groupUserRowSelection}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/users/${record.id_user}`, { state: { from: location.pathname } }),
          style: { cursor: 'pointer' }
        })}
      />
      <Button type="default" onClick={() => navigate(`/groups/${id_group}/edit`)} style={{ marginTop: '16px' }}>
        Volver al Grupo
      </Button>
    </div>
  );
}