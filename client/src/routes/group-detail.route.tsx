import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message, Table } from "antd";
import { useGroupQuery } from "../hooks/api/groups/use-group.query";
import { useUpdateGroupMutation } from "../hooks/api/groups/use-update-group.mutation";
import { useDeleteGroupMutation } from "../hooks/api/groups/use-delete-group.mutation";
import { useUsersByGroupQuery } from "../hooks/api/users/use-users-by-group.query";
import { useDeleteUserFromGroupMutation } from "../hooks/api/groups/use-delete-user-from-group.mutation";
import { Group } from "../shared/types/group/group";
import { useEffect, useState } from "react";

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

  return (
    <div>
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
        <Form.Item>
          <Button type="primary" htmlType="submit">Guardar</Button>
          <Button type="primary" danger onClick={handleDelete} style={{ marginLeft: '16px' }}>Eliminar Grupo</Button>
        </Form.Item>
      </Form>
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
      />
      <Button type="primary" danger onClick={handleDeleteUsers} style={{ marginTop: '16px' }}>
        Eliminar Usuarios Seleccionados
      </Button>
    </div>
  );
}