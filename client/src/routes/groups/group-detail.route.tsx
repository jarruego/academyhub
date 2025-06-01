import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message, Table, Tabs, DatePicker, Modal } from "antd";
import { useGroupQuery } from "../../hooks/api/groups/use-group.query";
import { useUpdateGroupMutation } from "../../hooks/api/groups/use-update-group.mutation";
import { useDeleteGroupMutation } from "../../hooks/api/groups/use-delete-group.mutation";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { useDeleteUserFromGroupMutation } from "../../hooks/api/groups/use-delete-user-from-group.mutation";
import { Group } from "../../shared/types/group/group";
import { useEffect, useState } from "react";
import { DeleteOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons"; // Importar los iconos
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

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
  const [modal, contextHolder] = Modal.useModal();

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
      await updateGroup({
        ...data,
        start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
        end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
      });
      message.success('Grupo actualizado exitosamente');
      navigate(`/courses/${groupData.id_course}`);
    } catch {
      message.error('No se pudo actualizar el grupo');
    }
  };

  const handleDelete = async () => {
    if (!groupData) return;
    modal.confirm({
      title: "¿Seguro que desea eliminar este grupo?",
      content: "Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteGroup();
          message.success('Grupo eliminado exitosamente');
          navigate(`/courses/${groupData.id_course}`);
        } catch {
          modal.error({
            title: "Error al eliminar el grupo",
            content: "No se pudo eliminar el grupo. Inténtelo de nuevo o asegúrese de que el grupo está vacío.",
          });
        }
      },
    });
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

  const items = [
    {
      key: "1",
      label: "Datos del Grupo",
      children: (
        <Form layout="vertical" onFinish={handleSubmit(submit)}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: "flex-start" }}>
            <Form.Item label="ID del grupo" name="id_group">
              <Controller name="id_group" control={control} render={({ field }) => <Input {...field} disabled />} />
            </Form.Item>
            <Form.Item label="ID FUNDAE" name="fundae_id">
              <Controller name="fundae_id" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="Nombre del grupo" name="group_name">
              <Controller name="group_name" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="Fecha Inicio" name="start_date">
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={date => field.onChange(date.startOf("day"))}
                    id="start_date"
                  />
                )}
              />
            </Form.Item>
            <Form.Item label="Fecha Fin" name="end_date">
              <Controller
                name="end_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={date => field.onChange(date.startOf("day"))}
                    id="end_date"
                  />
                )}
              />
            </Form.Item>
          </div>
          <Form.Item label="Descripción" name="description">
            <Controller name="description" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
            <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />}>Eliminar Grupo</Button>
          </div>
        </Form>
      ),
    },
    {
      key: "2",
      label: "Usuarios del Grupo",
      children: (
        <>
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
        </>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <Tabs defaultActiveKey="1" items={items} />
    </div>
  );
}