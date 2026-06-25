import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { App, Button, Form, Input, DatePicker, Select, Row, Col } from "antd";
import { useCreateGroupMutation } from "../../hooks/api/groups/use-create-group.mutation";
import { SaveOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import { useCourseQuery } from "../../hooks/api/courses/use-course.query";
import dayjs from "dayjs";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { GROUP_ACTIVE_MODE_OPTIONS } from "../../utils/group-active.util";

const CREATE_GROUP_FORM = z.object({
  group_name: z.string({ required_error: "El nombre del grupo es obligatorio" }).min(2, "El nombre es demasiado corto"),
  description: z.string().optional(),
  start_date: z.date().nullable().optional(),
  end_date: z.date().nullable().optional(),
  active_mode: z.enum(["auto", "active", "inactive"]).optional(),
  fundae_id: z.string().optional(),
  id_course: z.coerce.number(),
});

export default function CreateGroupRoute() {
  const { id_course } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: createGroup } = useCreateGroupMutation();
  const { handleSubmit, control, formState: { errors } } = useForm<z.infer<typeof CREATE_GROUP_FORM>>({
    resolver: zodResolver(CREATE_GROUP_FORM),
    defaultValues: {
      id_course: id_course ? Number(id_course) : undefined,
    }
  });
  const { data: course } = useCourseQuery(id_course || "");

  useEffect(() => {
    if (course) {
      document.title = `${course.course_name} - Crear Grupo`;
    }
  }, [course]);

  const { message: messageApi } = App.useApp();

  const submit: SubmitHandler<z.infer<typeof CREATE_GROUP_FORM>> = async (data) => {
    try {
      await createGroup({
        ...data,
        id_course: Number(id_course),
        start_date: data.start_date ? dayjs(data.start_date).utc().toDate() : null,
        end_date: data.end_date ? dayjs(data.end_date).utc().toDate() : null,
      });

      messageApi.success('Grupo creado exitosamente');
      navigate(`/courses/${id_course}`);
    } catch {
      messageApi.error('No se pudo crear el grupo');
    }
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item
          label="ID del curso"
          name="id_course"
          help={errors.id_course?.message}
          validateStatus={errors.id_course ? "error" : undefined}
        >
          <Controller name="id_course" control={control} render={({ field }) => <Input id="id_course" {...field} value={id_course} disabled />} />
        </Form.Item>
        <Form.Item
          label="Nombre del grupo"
          name="group_name"
          help={errors.group_name?.message}
          validateStatus={errors.group_name ? "error" : undefined}
        >
          <Controller name="group_name" control={control} render={({ field }) => <Input id="group_name" autoComplete="off" {...field} data-testid="group-name" />} />
        </Form.Item>
        <Form.Item
          label="Descripción"
          name="description"
          help={errors.description?.message}
          validateStatus={errors.description ? "error" : undefined}
        >
          <Controller name="description" control={control} render={({ field }) => <Input id="description" autoComplete="off" {...field} />} />
        </Form.Item>
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Fecha Inicio"
              name="start_date"
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
                    style={{ width: '100%' }}
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Fecha Fin"
              name="end_date"
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
                    style={{ width: '100%' }}
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="ID FUNDAE"
              name="fundae_id"
              help={errors.fundae_id?.message}
              validateStatus={errors.fundae_id ? "error" : undefined}
            >
              <Controller name="fundae_id" control={control} render={({ field }) => <Input id="fundae_id" autoComplete="off" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              label="Estado de actividad"
              name="active_mode"
              help={errors.active_mode?.message}
              validateStatus={errors.active_mode ? "error" : undefined}
            >
              <Controller
                name="active_mode"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="active_mode"
                    style={{ width: '100%' }}
                    value={field.value ?? 'auto'}
                    options={GROUP_ACTIVE_MODE_OPTIONS}
                    onChange={(value) => field.onChange(value)}
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>
        <div className="form-actions">
          <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Crear Grupo
          </Button>
          </AuthzHide>
        </div>
      </Form>
    </div>
  );
}