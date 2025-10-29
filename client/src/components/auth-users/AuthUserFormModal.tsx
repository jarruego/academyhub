import { Modal, Form, Input, Select } from 'antd';
import { getApiHost } from '../../utils/api/get-api-host.util';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useState, useEffect } from 'react';
import { AuthUser, AuthUserFormValues } from './types';

type Props = {
  open: boolean;
  // when mode is 'edit' provide user; when 'create' user can be null
  user?: AuthUser | null;
  mode?: 'edit' | 'create';
  onClose: () => void;
  onSaved?: (user: AuthUser) => void;
};

export default function AuthUserFormModal({ open, user = null, mode = 'edit', onClose, onSaved }: Props) {
  const [form] = Form.useForm<AuthUserFormValues>();
  // response type is AuthUser, but request data is AuthUserFormValues; keep the axios helper untyped here to avoid mismatched generic
  const authRequest = useAuthenticatedAxios<AuthUser>();
  const [loading, setLoading] = useState(false);

  // sync form when user changes or when opening in create mode
  useEffect(() => {
    if (mode === 'edit' && user) {
      // map user fields to form shape, avoid passing null values
      form.setFieldsValue({
        username: user.username,
        email: user.email,
        name: user.name,
        lastName: user.lastName ?? undefined,
        role: user.role,
      });
    }
    if (mode === 'create') {
      form.resetFields();
      form.setFieldsValue({ role: Role.VIEWER });
    }
  }, [user, mode, form]);

  const title = mode === 'create' ? 'Crear usuario de autenticación' : (user ? `Editar usuario: ${user.username}` : 'Editar usuario');

  return (
    <Modal
      title={title}
      open={open}
      onCancel={() => { onClose(); form.resetFields(); }}
      onOk={() => form.submit()}
      okText={mode === 'create' ? 'Crear' : 'Guardar'}
      confirmLoading={loading}
    >
      <Form form={form} layout="vertical" onFinish={async (values) => {
        setLoading(true);
        try {
          if (mode === 'create') {
            const res = await authRequest({ url: `${getApiHost()}/auth/users`, method: 'POST', data: values as unknown as AuthUser });
            const created = res?.data;
            onSaved && onSaved(created ?? (values as unknown as AuthUser));
          } else {
            if (!user) return;
            await authRequest({ url: `${getApiHost()}/auth/users/${user.id}`, method: 'PUT', data: values as unknown as AuthUser });
            onSaved && onSaved({ ...user, ...values } as AuthUser);
          }
          // do not auto-close here; let parent decide (parent may want to switch to edit mode after create)
          form.resetFields();
        } catch (err) {
          Modal.error({ title: 'Error', content: mode === 'create' ? 'No se pudo crear el usuario.' : 'No se pudo actualizar el usuario.' });
        } finally {
          setLoading(false);
        }
      }}>
        <Form.Item name="username" label="Usuario" rules={[{ required: true, message: 'El nombre de usuario es obligatorio' }]}>
          <Input autoComplete="username" />
        </Form.Item>

        <Form.Item name="password" label="Contraseña" rules={mode === 'create' ? [{ required: true, message: 'La contraseña es obligatoria' }, { min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }] : [{ min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email no válido' }, { required: true, message: 'El email es obligatorio' }]}>
          <Input autoComplete="email" />
        </Form.Item>

        <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'El nombre es obligatorio' }]}>
          <Input />
        </Form.Item>

        <Form.Item name="lastName" label="Apellidos">
          <Input />
        </Form.Item>

        <Form.Item name="role" label="Rol">
          <Select>
            <Select.Option value={Role.ADMIN}>Admin</Select.Option>
            <Select.Option value={Role.MANAGER}>Manager</Select.Option>
            <Select.Option value={Role.VIEWER}>Viewer</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
