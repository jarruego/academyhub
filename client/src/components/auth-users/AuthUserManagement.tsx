import { Card, Alert, Table, Button, Space, Empty, Typography, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useRole } from '../../utils/permissions/use-role';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AuthUserFormModal from './AuthUserFormModal';
import { AuthUser } from './types';
import { getApiHost } from '../../utils/api/get-api-host.util';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';

export default function AuthUserManagement() {
  const role = useRole();

  if (!role || role?.toLowerCase() !== Role.ADMIN) {
    return (
      <Card>
        <Alert
          message="Acceso denegado"
          description="Solo los administradores pueden acceder a la gestión de usuarios."
          type="error"
          showIcon
        />
      </Card>
    );
  }

  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const location = useLocation();

  function handleEdit(record: AuthUser) {
    setCreateMode(false);
    setEditingUser(record);
  }

  const columns = [
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Apellido', dataIndex: 'lastName', key: 'lastName' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Rol', dataIndex: 'role', key: 'role' },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: AuthUser) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>Editar</Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>Eliminar</Button>
        </Space>
      ),
    },
  ];

  const authRequest = useAuthenticatedAxios<AuthUser[]>();
  const authRequestRaw = useAuthenticatedAxios<any>();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();

  const fetchAuthUsers = async () => {
    // use authenticated axios to include Bearer token
    const res = await authRequest({ url: `${getApiHost()}/auth/users`, method: 'GET' });
    return res.data;
  };

  async function handleDelete(user: AuthUser) {
    modal.confirm({
      title: 'Confirmar eliminación',
      content: `¿Estás seguro de que quieres eliminar al usuario "${user.username}"? Esta acción es irreversible.`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      async onOk() {
          try {
          await authRequestRaw({ url: `${getApiHost()}/auth/users/${user.id}`, method: 'DELETE' });
          messageApi.success('Usuario eliminado');
          queryClient.invalidateQueries({ queryKey: ['auth_users'] });
        } catch (err) {
          messageApi.error('No se pudo eliminar el usuario');
        }
      }
    });
  }

  const { data, isLoading, error } = useQuery<AuthUser[], Error>({ queryKey: ['auth_users'], queryFn: fetchAuthUsers });
  const users: AuthUser[] = Array.isArray(data) ? data : [];

  useEffect(() => {
    // If navigated from create page with state.openEditFor (username), open modal for that username
    type LocationState = { openEditFor?: string };
    const state = (location as unknown as { state?: LocationState }).state || {} as LocationState;
    const usernameToOpen = state.openEditFor as string | undefined;
    if (usernameToOpen) {
      // if users already loaded, find and open; otherwise wait for users
      const found = users.find((u: AuthUser) => u.username === usernameToOpen);
      if (found) {
        handleEdit(found);
        // clear navigation state (best-effort, doesn't mutate history)
        try { (location as unknown as { state?: LocationState }).state = {}; } catch {}
      }
    }
  }, [location, users]);

  return (
    <div>
    {modalContextHolder}
    {messageContextHolder}
      <AuthUserFormModal
        open={!!editingUser || createMode}
        user={editingUser ?? null}
        mode={createMode ? 'create' : 'edit'}
        onClose={() => { setEditingUser(null); setCreateMode(false); queryClient.invalidateQueries({ queryKey: ['auth_users'] }); }}
        onSaved={() => {
          // savedUser: for create -> created user, for edit -> updated user
          queryClient.invalidateQueries({ queryKey: ['auth_users'] });
          if (createMode) {
            // close modal after creation
            setCreateMode(false);
            setEditingUser(null);
          } else {
            // close edit modal after update
            setEditingUser(null);
          }
        }}
      />
      <Card title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>Gestión de usuarios (auth_users)</Typography.Title>
          <Typography.Text type="secondary">Gestiona los usuarios de autentificación de la aplicación y sus roles.</Typography.Text>
        </div>
        <div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateMode(true); setEditingUser(null); }}>Crear usuario de autenticación</Button>
        </div>
      </div>} style={{ marginTop: 16 }}>
        {error ? (
          <Alert type="error" message="Error" description="No se pudieron cargar los usuarios." />
        ) : isLoading ? (
          <Table columns={columns} dataSource={[]} rowKey="id" loading />
        ) : users.length === 0 ? (
          <Empty description="No hay usuarios." />
        ) : (
          <Table columns={columns} dataSource={users} rowKey="id" />
        )}
      </Card>
    </div>
  );
}
