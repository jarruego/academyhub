import { App, Modal, Form, Input, Select, Tabs, Table, Button, Popconfirm } from 'antd';
import { getApiHost } from '../../utils/api/get-api-host.util';
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { useState, useEffect } from 'react';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { AuthUser, AuthUserFormValues } from './types';
import { useMoodleLinksByAuthUser } from '../../hooks/api/auth-users/use-moodle-links-by-auth-user.query';
import { useAddMoodleLink } from '../../hooks/api/auth-users/use-add-moodle-link.mutation';
import { useDeleteMoodleLink } from '../../hooks/api/auth-users/use-delete-moodle-link.mutation';
import { useSearchMoodleUsers } from '../../hooks/api/moodle-users/use-search-moodle-users.query';
import type { MoodleUserAuthUserLink } from './types.moodle-link';

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
  const [moodleForm] = Form.useForm();
  const [showTokenId, setShowTokenId] = useState<number | null>(null);
  // response type is AuthUser, but request data is AuthUserFormValues; keep the axios helper untyped here to avoid mismatched generic
  const authRequest = useAuthenticatedAxios<AuthUser>();
  const [loading, setLoading] = useState(false);
  const { message: msg, modal } = App.useApp();

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

  // Moodle links logic (only in edit mode and user exists)
  const authUserId = user?.id;
  const { data: moodleLinks = [], isLoading: loadingLinks } = useMoodleLinksByAuthUser(authUserId);
  const [search, setSearch] = useState('');
  const { data: moodleUsers = [], isLoading: loadingMoodleUsers } = useSearchMoodleUsers(search);
  const addMoodleLink = useAddMoodleLink(authUserId);
  const deleteMoodleLink = useDeleteMoodleLink(authUserId);

  return (
    <>
      <Modal
        title={title}
        open={open}
        onCancel={() => { onClose(); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={mode === 'create' ? 'Crear' : 'Guardar'}
        confirmLoading={loading}
        width={700}
      >
        <Tabs
          defaultActiveKey="main"
          items={[
            {
              key: 'main' as const,
              label: 'Datos usuario',
              children: (
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
                    form.resetFields();
                  } catch (err) {
                    modal.error({ title: 'Error', content: mode === 'create' ? 'No se pudo crear el usuario.' : 'No se pudo actualizar el usuario.' });
                  } finally {
                    setLoading(false);
                  }
                }}>
                  <button type="submit" style={{ display: 'none' }} aria-hidden />
                  <Form.Item name="username" label="Usuario" rules={[{ required: true, message: 'El nombre de usuario es obligatorio' }]}> 
                    <Input autoComplete="username" />
                  </Form.Item>
                  <Form.Item name="password" label="Contraseña" rules={mode === 'create' ? [{ required: true, message: 'La contraseña es obligatoria' }, { min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }] : [{ min: 8, message: 'La contraseña debe tener al menos 8 caracteres' }]}>
                    <Input.Password autoComplete="new-password" placeholder={mode === 'edit' ? 'Dejar en blanco para no cambiar' : undefined} />
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
              ),
            },
            mode === 'edit' && user && {
              key: 'moodle-links',
              label: 'Vínculos Moodle',
              children: (
                <div>
                  <Table
                    dataSource={moodleLinks}
                    rowKey="id"
                    loading={loadingLinks}
                    columns={[
                      {
                        title: 'Usuario Moodle',
                        dataIndex: ['moodle_user', 'moodle_username'],
                        key: 'moodle_username',
                        render: (_: any, record: MoodleUserAuthUserLink) => record.moodle_user?.moodle_username || '',
                      },
                      {
                        title: 'Token',
                        dataIndex: 'moodle_token',
                        key: 'moodle_token',
                        render: (token: string, record: MoodleUserAuthUserLink) => token ? (
                          <span>
                            {showTokenId === record.id ? token : '•'.repeat(8)}
                            <Button
                              type="link"
                              size="small"
                              icon={showTokenId === record.id ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                              onClick={() => setShowTokenId(showTokenId === record.id ? null : record.id)}
                              style={{ marginLeft: 4, padding: 0, height: 20 }}
                            />
                          </span>
                        ) : '',
                      },
                      {
                        title: 'Acciones',
                        key: 'actions',
                        render: (_: any, record: MoodleUserAuthUserLink) => (
                          <Popconfirm title="¿Eliminar vínculo?" onConfirm={() => {
                            deleteMoodleLink.mutate(record.id, {
                              onSuccess: () => msg.success('Vínculo eliminado'),
                              onError: () => msg.error('No se pudo eliminar el vínculo'),
                            });
                          }}>
                            <Button size="small" danger>Eliminar</Button>
                          </Popconfirm>
                        ),
                      },
                    ]}
                    pagination={false}
                    style={{ marginBottom: 16 }}
                  />
                  <Form
                    form={moodleForm}
                    layout="inline"
                    onFinish={values => {
                      addMoodleLink.mutate({ id_moodle_user: values.id_moodle_user, moodle_token: values.moodle_token }, {
                        onSuccess: () => {
                          moodleForm.resetFields();
                          msg.success('Vínculo añadido');
                        },
                        onError: () => msg.error('No se pudo añadir el vínculo'),
                      });
                    }}
                  >
                    <Form.Item
                      name="id_moodle_user"
                      label="Usuario Moodle"
                      rules={[{ required: true, message: 'Selecciona un usuario de Moodle' }]}
                    >
                      <Select
                        style={{ minWidth: 220 }}
                        placeholder="Buscar usuario de Moodle"
                        showSearch
                        filterOption={false}
                        onSearch={setSearch}
                        notFoundContent={loadingMoodleUsers ? 'Buscando...' : 'Sin resultados'}
                        allowClear
                      >
                        {moodleUsers.map(mu => (
                          <Select.Option key={mu.id_moodle_user} value={mu.id_moodle_user}>
                            {mu.moodle_username}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name="moodle_token"
                      label="Token"
                      rules={[{ required: true, message: 'Introduce el token' }]}
                    >
                      <Input.Password style={{ minWidth: 180 }} placeholder="Token de Moodle" />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit">
                        Añadir vínculo
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
          ].filter((item): item is Exclude<typeof item, false | null> => Boolean(item))}
        />
      </Modal>
    </>
  );
}
