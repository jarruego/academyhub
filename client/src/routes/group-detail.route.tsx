import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message, Table, Tabs } from "antd";
import { useGroupQuery } from "../hooks/api/groups/use-group.query";
import { useUpdateGroupMutation } from "../hooks/api/groups/use-update-group.mutation";
import { useDeleteGroupMutation } from "../hooks/api/groups/use-delete-group.mutation";
import { useUsersByGroupQuery } from "../hooks/api/users/use-users-by-group.query";
import { useDeleteUserFromGroupMutation } from "../hooks/api/groups/use-delete-user-from-group.mutation";
import { Group } from "../shared/types/group/group";
import { useEffect, useState } from "react";
import { DeleteOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons"; // Importar los iconos

export default function EditGroupRoute() {
  const { id_group } = useParams();
  const navigate = useNavigate();
  const { data: groupData, isLoading: isGroupLoading } = useGroupQuery(id_group || "");
  const { mutateAsync: updateGroup } = useUpdateGroupMutation(id_group || "");
  const { mutateAsync: deleteGroup } = useDeleteGroupMutation(id_group || "");
  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useUsersByGroupQuery(id_group ? parseInt(id_group, 10) : null);
  const { mutateAsync: deleteUserFromGroup } = useDeleteUserFromGroupMutation();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const { handleSubmit, control, reset } = useForm<Group>();

  useEffect(() => {
    if (groupData) {
      reset(groupData);
    }
  }, [groupData, reset]);

  useEffect(() => {
    document.title = `Detalles del Grupo ${id_group}`;
  }, [id_group]);

  if (isGroupLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<Group> = async (data) => {
    if (!groupData) return;
    try {
      await updateGroup(data);
      message.success('Grupo actualizado exitosamente');
      navigate(`/courses/${groupData.id_course}`);
    } catch {
      message.error('No se pudo actualizar el grupo');
    }
  };

  const handleDelete = async () => {
    if (!groupData) return;
    try {
      await deleteGroup();
      message.success('Grupo eliminado exitosamente');
      navigate(`/courses/${groupData.id_course}`);
    } catch {
      message.error('No se pudo eliminar el grupo');
    }
  };

  const handleDeleteUsers = async () => {
    if (!id_group || selectedUserIds.length === 0) return;
    try {
      await Promise.all(selectedUserIds.map(id_user => deleteUserFromGroup({ id_group: parseInt(id_group, 10), id_user })));
      message.success('Usuarios eliminados exitosamente');
      setSelectedUserIds([]);
      await refetchUsers();
    } catch {
      message.error('No se pudo eliminar a los usuarios');
    }
  };

  const handleAddUserToGroup = () => {
    navigate(`/groups/${id_group}/add-user`);
  };

  const handleImportUsers = () => {
    navigate(`/groups/${id_group}/import-users`);
  };

  const rowSelection = {
    selectedRowKeys: selectedUserIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedUserIds(selectedRowKeys as number[]);
    },
  };

  return (
    <div>
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab="Datos del Grupo" key="1">
          <Form layout="vertical" onFinish={handleSubmit(submit)}>
            <Form.Item label="ID del grupo" name="id_group">
              <Controller name="id_group" control={control} render={({ field }) => <Input {...field} disabled />} />
            </Form.Item>
            <Form.Item label="Nombre del grupo" name="group_name">
              <Controller name="group_name" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="Descripción" name="description">
              <Controller name="description" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
              <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />}>Eliminar Grupo</Button>
            </div>
          </Form>
        </Tabs.TabPane>
        <Tabs.TabPane tab="Usuarios del Grupo" key="2">
          <h2>Usuarios Grupo</h2>
          <Table
            rowKey="id_user"
            columns={[
              { title: 'ID', dataIndex: ['id_user'] },
              { title: 'Nombre', dataIndex: ['name'] },
              { title: 'Apellidos', dataIndex: ['surname'] },
              { title: 'Email', dataIndex: ['email'] },
            ]}
            dataSource={usersData}
            loading={isUsersLoading}
            rowSelection={rowSelection}
            onRow={(record) => ({
              onClick: () => {
                setSelectedUserIds((prevSelected) => {
                  if (prevSelected.includes(record.id_user)) {
                    return prevSelected.filter((id) => id !== record.id_user);
                  } else {
                    return [...prevSelected, record.id_user];
                  }
                });
              },
              onDoubleClick: () => navigate(`/users/${record.id_user}`, { state: { from: location.pathname } }),
              style: { cursor: 'pointer' }
            })}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUserToGroup} >
              Añadir Usuarios al Grupo
            </Button>
            <Button type="primary" danger onClick={handleDeleteUsers} icon={<DeleteOutlined />}>
              Eliminar Usuarios Seleccionados
            </Button>
            <Button type="primary" onClick={handleImportUsers}>
              Importar Usuarios
            </Button>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}