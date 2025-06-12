import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message, Table, Tabs, DatePicker, Modal } from "antd";
import { useGroupQuery } from "../../hooks/api/groups/use-group.query";
import { useUpdateGroupMutation } from "../../hooks/api/groups/use-update-group.mutation";
import { useDeleteGroupMutation } from "../../hooks/api/groups/use-delete-group.mutation";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { useEffect } from "react";
import { DeleteOutlined, SaveOutlined, TeamOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
dayjs.extend(utc);

const GROUP_FORM_SCHEMA = z.object({
  id_group: z.number(),
  moodle_id: z.number().optional().nullish(),
  group_name: z.string({ required_error: "El nombre del grupo es obligatorio" }).min(2, "El nombre es demasiado corto"),
  id_course: z.number(),
  description: z.string().optional().nullish(),
  start_date: z.date().nullish(),
  end_date: z.date().nullish(),
  fundae_id: z.string().optional().nullish(),
});

export default function EditGroupRoute() {
  const { id_group } = useParams();
  const navigate = useNavigate();
  const { data: groupData, isLoading: isGroupLoading } = useGroupQuery(id_group || "");
  const { mutateAsync: updateGroup } = useUpdateGroupMutation(id_group || "");
  const { mutateAsync: deleteGroup } = useDeleteGroupMutation(id_group || "");
  const { data: usersData, isLoading: isUsersLoading } = useUsersByGroupQuery(id_group ? parseInt(id_group, 10) : null);
  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof GROUP_FORM_SCHEMA>>({
    resolver: zodResolver(GROUP_FORM_SCHEMA),
  });
  const [modal, contextHolder] = Modal.useModal();

  useEffect(() => {
    if (groupData) {
      reset({
        ...groupData,
        start_date: groupData.start_date ? dayjs(groupData.start_date).utc().toDate() : null,
        end_date: groupData.end_date ? dayjs(groupData.end_date).utc().toDate() : null,
      });
    }
  }, [groupData, reset]);

  useEffect(() => {
    document.title = `Detalles del Grupo ${id_group}`;
  }, [id_group]);

  if (isGroupLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<z.infer<typeof GROUP_FORM_SCHEMA>> = async (data) => {
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

  const handleAddUserToGroup = () => {
    navigate(`/groups/${id_group}/add-user`);
  };

  const handleImportUsers = () => {
    navigate(`/groups/${id_group}/import-users`);
  };

  const items = [
    {
      key: "1",
      label: "Datos del Grupo",
      children: (
        <Form layout="vertical" onFinish={handleSubmit(submit)}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: "flex-start" }}>
            <Form.Item label="ID del grupo" name="id_group"
              help={errors.id_group?.message}
              validateStatus={errors.id_group ? "error" : undefined}
            >
              <Controller name="id_group" control={control} render={({ field }) => <Input {...field} disabled />} />
            </Form.Item>
            <Form.Item label="ID FUNDAE" name="fundae_id"
              help={errors.fundae_id?.message}
              validateStatus={errors.fundae_id ? "error" : undefined}
            >
              <Controller
                name="fundae_id"
                control={control}
                render={({ field }) => <Input {...field} value={field.value ?? ""} />}
              />
            </Form.Item>
            <Form.Item label="Nombre del grupo" name="group_name"
              help={errors.group_name?.message}
              validateStatus={errors.group_name ? "error" : undefined}
            >
              <Controller name="group_name" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
            <Form.Item label="Fecha Inicio" name="start_date"
              help={errors.start_date?.message}
              validateStatus={errors.start_date ? "error" : undefined}
            >
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={date => field.onChange(date ? date.toDate() : null)}
                    id="start_date"
                  />
                )}
              />
            </Form.Item>
            <Form.Item label="Fecha Fin" name="end_date"
              help={errors.end_date?.message}
              validateStatus={errors.end_date ? "error" : undefined}
            >
              <Controller
                name="end_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={date => field.onChange(date ? date.toDate() : null)}
                    id="end_date"
                  />
                )}
              />
            </Form.Item>
          </div>
          </div>
          <Form.Item label="Descripción" name="description"
            help={errors.description?.message}
            validateStatus={errors.description ? "error" : undefined}
          >
            <Controller name="description" control={control} render={({ field }) => <Input {...field} value={field.value ?? ""} />} />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Button type="default" onClick={() => navigate(`/courses/${groupData?.id_course}`)}>Volver al Curso</Button>
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
            <Button type="default" onClick={() => navigate(`/courses/${groupData?.id_course}`)}>Volver al Curso</Button>
            <Button type="primary" icon={<TeamOutlined />} onClick={handleAddUserToGroup} >
              Gestionar Usuarios del Grupo
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