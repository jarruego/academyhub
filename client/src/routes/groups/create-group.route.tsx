import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message, DatePicker } from "antd";
import { useCreateGroupMutation } from "../../hooks/api/groups/use-create-group.mutation";
import { Group } from "../../shared/types/group/group";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import { useCourseQuery } from "../../hooks/api/courses/use-course.query";
import dayjs from "dayjs";

export default function CreateGroupRoute() {
  const { id_course } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: createGroup } = useCreateGroupMutation();
  const { handleSubmit, control } = useForm<Omit<Group, 'id_group'>>();
  const { data: course } = useCourseQuery(id_course || "");

  useEffect(() => {
    if (course) {
      document.title = `${course.course_name} - Crear Grupo`;
    }
  }, [course]);

  const submit: SubmitHandler<Omit<Group, 'id_group'>> = async (data) => {
    try {
      await createGroup({
        ...data,
          id_course: Number(id_course),
        start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
        end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
      });

      message.success('Grupo creado exitosamente');
      navigate(`/courses/${id_course}`);
    } catch {
      message.error('No se pudo crear el grupo');
    }
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item label="ID del curso" name="id_course">
          <Controller name="id_course" control={control} render={({ field }) => <Input {...field} value={id_course} disabled />} />
        </Form.Item>
        <Form.Item label="Nombre del grupo" name="group_name">
          <Controller name="group_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Descripción" name="description">
          <Controller name="description" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item label="Fecha Inicio" name="start_date">
            <Controller name="start_date" control={control} render={({ field }) => <DatePicker {...field} id="start_date" />} />
          </Form.Item>
          <Form.Item label="Fecha Fin" name="end_date">
            <Controller name="end_date" control={control} render={({ field }) => <DatePicker {...field} id="end_date" />} />
          </Form.Item>
          <Form.Item label="ID FUNDAE" name="fundae_id">
            <Controller name="fundae_id" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Crear Grupo
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} style={{ marginLeft: '16px' }}>
            Refrescar
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}