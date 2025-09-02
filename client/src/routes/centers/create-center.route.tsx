import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { App, Button, Form, Input } from "antd";
import { useCreateCenterMutation } from "../../hooks/api/centers/use-create-center.mutation";
import { SaveOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const CREATE_CENTER_FORM = z.object({
  employer_number: z.string().optional(),
  center_name: z.string({ required_error: "El nombre del centro es obligatorio" }).min(2, "El nombre es demasiado corto"),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email("El email no es válido").optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export default function CreateCenterRoute() {
  const { message } = App.useApp();
  const { id_company } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: createCenter } = useCreateCenterMutation();
  const { handleSubmit, control, formState: { errors } } = useForm<z.infer<typeof CREATE_CENTER_FORM>>({
    resolver: zodResolver(CREATE_CENTER_FORM),
  });

  useEffect(() => {
    document.title = "Crear Centro";
  }, []);

  const submit: SubmitHandler<z.infer<typeof CREATE_CENTER_FORM>> = async (data) => {
    try {
      await createCenter({ ...data, id_company: Number(id_company) });
      message.success('Centro creado exitosamente');
      navigate(`/companies/${id_company}?tab=centers`); 
    } catch {
      message.error('No se pudo crear el centro');
    }
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item
            label="Número de patronal"
            name="employer_number"
            help={errors.employer_number?.message}
            validateStatus={errors.employer_number ? "error" : undefined}
          >
            <Controller name="employer_number" control={control} render={({ field }) => <Input data-testid="employer-number" {...field} />} />
          </Form.Item>
        </div>
        <Form.Item
          label="Nombre del centro"
          name="center_name"
          help={errors.center_name?.message}
          validateStatus={errors.center_name ? "error" : undefined}
        >
          <Controller name="center_name" control={control} render={({ field }) => <Input data-testid="center-name" {...field} />} />
        </Form.Item>
        <Form.Item
          label="Persona de contacto"
          name="contact_person"
          help={errors.contact_person?.message}
          validateStatus={errors.contact_person ? "error" : undefined}
        >
          <Controller name="contact_person" control={control} render={({ field }) => <Input data-testid="contact-person" {...field} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Form.Item
            label="Teléfono de contacto"
            name="contact_phone"
            help={errors.contact_phone?.message}
            validateStatus={errors.contact_phone ? "error" : undefined}
          >
            <Controller name="contact_phone" control={control} render={({ field }) => <Input data-testid="contact-phone" {...field} />} />
          </Form.Item>
          <Form.Item
            label="Email de contacto"
            name="contact_email"
            help={errors.contact_email?.message}
            validateStatus={errors.contact_email ? "error" : undefined}
          >
            <Controller name="contact_email" control={control} render={({ field }) => <Input data-testid="contact-email" {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="submit">
            Guardar
          </Button>
          </AuthzHide>
        </div>
      </Form>
    </div>
  );
}
