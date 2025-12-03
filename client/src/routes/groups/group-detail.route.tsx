import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message, Tabs, DatePicker, Modal, Tag } from "antd";
import { useGroupQuery } from "../../hooks/api/groups/use-group.query";
import { useCourseQuery } from "../../hooks/api/courses/use-course.query";
import { useUpdateGroupMutation } from "../../hooks/api/groups/use-update-group.mutation";
import { useDeleteGroupMutation } from "../../hooks/api/groups/use-delete-group.mutation";
import { usePushGroupToMoodleMutation } from "../../hooks/api/moodle/use-push-group-to-moodle.mutation";
import { useDeleteMoodleGroupMutation } from "../../hooks/api/moodle/use-delete-moodle-group.mutation";
import { useUsersByGroupQuery } from "../../hooks/api/users/use-users-by-group.query";
import { useEffect } from "react";
import { DeleteOutlined, SaveOutlined, CloudUploadOutlined } from "@ant-design/icons";
import GroupUsersManager from '../../components/group/GroupUsersManager';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
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
  const { data: courseData } = useCourseQuery(groupData?.id_course ? String(groupData.id_course) : "");
  const { mutateAsync: updateGroup } = useUpdateGroupMutation(id_group || "");
  const { mutateAsync: deleteGroup } = useDeleteGroupMutation(id_group || "");
  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof GROUP_FORM_SCHEMA>>({
    resolver: zodResolver(GROUP_FORM_SCHEMA),
  });
  const [modal, contextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  const pushGroupMutation = usePushGroupToMoodleMutation();
  const deleteMoodleGroupMutation = useDeleteMoodleGroupMutation();
  const { data: usersInGroup } = useUsersByGroupQuery(id_group ? parseInt(id_group, 10) : null);

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
    // Set browser tab title to group name when available, fallback to id
    if (groupData && groupData.group_name) {
      document.title = String(groupData.group_name);
    } else {
      document.title = `Detalles del Grupo ${id_group}`;
    }
  }, [id_group, groupData]);

  if (isGroupLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<z.infer<typeof GROUP_FORM_SCHEMA>> = async (data) => {
    if (!groupData) return;
    try {
      await updateGroup({
        ...data,
        start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
        end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
      });
    messageApi.success('Grupo actualizado exitosamente');
      navigate(`/courses/${groupData.id_course}`);
    } catch {
    messageApi.error('No se pudo actualizar el grupo');
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
            messageApi.success('Grupo eliminado exitosamente');
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

  

  const items = [
    {
      key: "2",
      label: "Usuarios del Grupo",
      children: (
        <>
          {messageContextHolder}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0}}>Usuarios del Grupo {groupData?.group_name ? `- ${groupData.group_name}` : ''}</h2>
            {courseData?.course_name && (
              <div style={{ marginLeft: 12 }}>
                <a href={`/courses/${courseData.id_course}`} target="_blank" rel="noopener noreferrer">
                  <Tag color="blue" style={{ cursor: 'pointer' }}>{courseData.course_name}</Tag>
                </a>
              </div>
            )}
          </div>
          <GroupUsersManager groupId={id_group ? parseInt(id_group, 10) : null} />
        </>
      ),
    },
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
              <Controller name="id_group" control={control} render={({ field }) => <Input id="id_group" {...field} disabled />} />
            </Form.Item>
            <Form.Item label="ID FUNDAE" name="fundae_id"
              help={errors.fundae_id?.message}
              validateStatus={errors.fundae_id ? "error" : undefined}
            >
              <Controller
                name="fundae_id"
                control={control}
                render={({ field }) => <Input id="fundae_id" autoComplete="off" {...field} value={field.value ?? ""} />}
              />
            </Form.Item>
            <Form.Item label="Nombre del grupo" name="group_name"
              help={errors.group_name?.message}
              validateStatus={errors.group_name ? "error" : undefined}
            >
              <Controller name="group_name" control={control} render={({ field }) => <Input id="group_name" autoComplete="off" {...field} data-testid="group-name" />} />
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
          <Form.Item label="Descripción" name="description"
            help={errors.description?.message}
            validateStatus={errors.description ? "error" : undefined}
          >
            <Controller name="description" control={control} render={({ field }) => <Input id="description" autoComplete="off" {...field} value={field.value ?? ""} data-testid="group-description" />} />
          </Form.Item>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            {/* Moodle status */}
            {groupData?.moodle_id ? (
              <Tag color="green">Moodle ID: {groupData.moodle_id}</Tag>
            ) : (
              <Tag color="orange">No subido a Moodle</Tag>
            )}

            {/* Upload button (visible to admins) - moved here from the actions area */}
            <AuthzHide roles={[Role.ADMIN]}>
              <Button
                icon={<CloudUploadOutlined style={{ color: '#f58b00' }} />}
                loading={pushGroupMutation.status === 'pending'}
                disabled={pushGroupMutation.status === 'pending'}
                onClick={() => {
                  if (!groupData) return;

                  modal.confirm({
                    title: 'Confirmar subida a Moodle',
                    content: (
                      <div>
                        <p>Esta acción subirá los datos del grupo a Moodle. Se enviarán nombre y descripción y se creará o actualizará el grupo en Moodle si ya existe.</p>
                        <p>Asegúrese de que toda la información es correcta antes de continuar.</p>
                        <p>Esta acción no sube los usuarios, sólo los datos del grupo.</p>
                      </div>
                    ),
                    okText: 'Subir',
                    cancelText: 'Cancelar',
                    onOk: async () => {
                      try {
                        const res = await pushGroupMutation.mutateAsync(groupData.id_group);
                        const msg = res?.data?.message || 'Operación completada';
                        messageApi.success(msg);
                      } catch (err) {
                        messageApi.error('Error al subir el grupo a Moodle');
                      }
                    }
                  });
                }}
              >
                Subir a Moodle
              </Button>
              {/* Show delete-in-Moodle button when group has no users and is already uploaded */}
              {groupData?.moodle_id && (usersInGroup?.length ?? 0) === 0 && (
                <Button
                  style={{ marginLeft: 8 }}
                  danger
                  onClick={() => {
                    modal.confirm({
                      title: 'Eliminar grupo en Moodle',
                      content: '¿Desea eliminar este grupo en Moodle? Esta acción sólo eliminará el grupo en Moodle y dejará vacío el campo moodle_id aquí.',
                      okText: 'Eliminar en Moodle',
                      cancelText: 'Cancelar',
                      onOk: async () => {
                        try {
                          const res = await deleteMoodleGroupMutation.mutateAsync(groupData.id_group);
                          const msg = res?.data?.message || 'Grupo eliminado en Moodle';
                          messageApi.success(msg);
                        } catch (err) {
                          modal.error({
                            title: 'Error al eliminar en Moodle',
                            content: 'No se pudo eliminar el grupo en Moodle. Compruebe los permisos y vuelva a intentarlo.'
                          });
                        }
                      }
                    });
                  }}
                >
                  Eliminar en Moodle
                </Button>
              )}
            </AuthzHide>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <AuthzHide roles={[Role.ADMIN]}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="save-group">Guardar</Button>
            <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />}>Eliminar Grupo</Button>
            </AuthzHide>
          </div>
        </Form>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      {messageContextHolder}
      <Tabs defaultActiveKey="2" items={items} />
    </div>
  );
}