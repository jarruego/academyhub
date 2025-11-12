import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input, Table, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useUsersQuery } from '../../hooks/api/users/use-users.query';
import { useAddUserToGroupMutation } from '../../hooks/api/groups/use-add-user-to-group.mutation';
import { useUsersByGroupQuery } from '../../hooks/api/users/use-users-by-group.query';
import { useDeleteUserFromGroupMutation } from '../../hooks/api/groups/use-delete-user-from-group.mutation';
import { useDebounce } from '../../hooks/use-debounce';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { AuthzHide } from '../permissions/authz-hide';
import { User } from '../../shared/types/user/user';

interface Props {
  open: boolean;
  groupId?: string | number | null;
  onClose: () => void;
}

const CreateUserGroupModal: React.FC<Props> = ({ open, groupId, onClose }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const debouncedSearch = useDebounce(searchTerm, 400);

  const normalizedSearch = useMemo(() => {
    if (!debouncedSearch) return '';
    return debouncedSearch
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }, [debouncedSearch]);

  const { data: usersResponse, isLoading: isUsersLoading } = useUsersQuery({ page: currentPage, limit: pageSize, search: normalizedSearch });
  const usersData = usersResponse?.data ?? [];
  const { mutateAsync: addUserToGroup } = useAddUserToGroupMutation();
  const { data: groupUsersData, isLoading: isGroupUsersLoading, refetch: refetchUsers } = useUsersByGroupQuery(groupId ? parseInt(String(groupId), 10) : null);
  const { mutateAsync: deleteUserFromGroup } = useDeleteUserFromGroupMutation();

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<number[]>([]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleSaveUsers = async () => {
    if (!groupId || selectedUserIds.length === 0) return;
    try {
      await Promise.all(selectedUserIds.map(id_user => addUserToGroup({ id_group: parseInt(String(groupId), 10), id_user })));
      messageApi.success('Usuarios añadidos exitosamente');
      setSelectedUserIds([]);
      await refetchUsers();
    } catch (err) {
      console.error('Error añadiendo usuarios al grupo', err);
      messageApi.error('No se pudo añadir a los usuarios');
    }
  };

  const handleDeleteUsers = async () => {
    if (!groupId || selectedGroupUserIds.length === 0) return;
    try {
      await Promise.all(selectedGroupUserIds.map(id_user => deleteUserFromGroup({ id_group: parseInt(String(groupId), 10), id_user })));
      messageApi.success('Usuarios eliminados exitosamente');
      setSelectedGroupUserIds([]);
      await refetchUsers();
    } catch (err) {
      console.error('Error eliminando usuarios del grupo', err);
      messageApi.error('No se pudo eliminar a los usuarios');
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

  const filteredUsersData = usersData?.filter(user => !groupUsersData?.some(groupUser => groupUser.id_user === user.id_user)) ?? [];

  return (
    <Modal
      title={`Añadir usuarios al grupo ${groupId ?? ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
      destroyOnClose
    >
      {contextHolder}
      <div style={{ marginBottom: 12 }}>
        <Input
          id="user-search"
          placeholder="Buscar usuarios"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ marginBottom: 8 }}
          aria-label="Buscar usuarios"
        />
        <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleSaveUsers} disabled={selectedUserIds.length === 0} style={{ marginBottom: 8 }}>
            Añadir al Grupo
          </Button>
        </AuthzHide>
      </div>

      <Table
        id="all-users-table"
        rowKey="id_user"
        columns={[
          { title: 'ID', dataIndex: 'id_user' },
          { title: 'Nombre', dataIndex: 'name' },
          { title: 'Apellidos', dataIndex: 'surname' },
          { title: 'Email', dataIndex: 'email' },
        ]}
        dataSource={filteredUsersData}
        loading={isUsersLoading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: usersResponse?.total || 0,
          showSizeChanger: false,
          onChange: (page: number, size?: number) => {
            setCurrentPage(page);
            if (size) setPageSize(size);
          }
        }}
        rowSelection={{
          ...rowSelection,
          getCheckboxProps: (record: User) => ({
            id: `add-user-checkbox-${record.id_user}`,
            name: `add-user-checkbox-${record.id_user}`,
          }),
        }}
        onRow={(record) => ({
          onDoubleClick: () => {
            const uid = Number(record.id_user);
            if (!Number.isFinite(uid)) return;
            try {
              const url = `${window.location.origin}/users/${uid}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (e) {
              window.open(`/users/${uid}`, '_blank');
            }
          },
          style: { cursor: 'pointer' }
        })}
      />

      <h3 style={{ marginTop: 16 }}>Usuarios del Grupo</h3>
      <AuthzHide roles={[Role.ADMIN]}>
        <Button type="primary" danger onClick={handleDeleteUsers} style={{ marginTop: '8px', marginBottom: 8 }} icon={<DeleteOutlined />} disabled={selectedGroupUserIds.length === 0}>
          Eliminar del Grupo
        </Button>
      </AuthzHide>
      <Table
        id="group-users-table"
        rowKey="id_user"
        columns={[
          { title: 'ID', dataIndex: 'id_user' },
          { title: 'Nombre', dataIndex: 'name' },
          { title: 'Apellidos', dataIndex: 'surname' },
          { title: 'Email', dataIndex: 'email' },
        ]}
        dataSource={groupUsersData}
        loading={isGroupUsersLoading}
        rowSelection={{
          ...groupUserRowSelection,
          getCheckboxProps: (record: User) => ({
            id: `remove-user-checkbox-${record.id_user}`,
            name: `remove-user-checkbox-${record.id_user}`,
          }),
        }}
        onRow={(record) => ({
          onDoubleClick: () => {
            const uid = Number(record.id_user);
            if (!Number.isFinite(uid)) return;
            try {
              const url = `${window.location.origin}/users/${uid}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch (e) {
              window.open(`/users/${uid}`, '_blank');
            }
          },
          style: { cursor: 'pointer' }
        })}
      />
    </Modal>
  );
};

export default CreateUserGroupModal;
