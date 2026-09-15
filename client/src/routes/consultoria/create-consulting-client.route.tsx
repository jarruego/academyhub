import { useCreateConsultingClientMutation } from "../../hooks/api/consulting-client/use-create-consulting-client.mutation";
import { App, Button, Form, Input } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { SaveOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const CREATE_CONSULTING_CLIENT_FORM = z.object({
  name: z.string({ required_error: "El nombre es obligatorio" }).min(2, "El nombre no puede ser tan corto"),
});

export default function CreateConsultingClientRoute() {
  const { message } = App.useApp();
  const { mutateAsync: createConsultingClient } = useCreateConsultingClientMutation();

  const { handleSubmit, control, formState: { errors } } = useForm<z.infer<typeof CREATE_CONSULTING_CLIENT_FORM>>({
    resolver: zodResolver(CREATE_CONSULTING_CLIENT_FORM)
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Crear Cliente de Consultoría";
  }, []);

  const submit: SubmitHandler<z.infer<typeof CREATE_CONSULTING_CLIENT_FORM>> = async (info) => {
    try {
      await createConsultingClient(info);
      navigate('/consultoria');
    } catch {
      message.error('No se pudo guardar el formulario. Inténtalo de nuevo.');
    }
  }

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item
          label="Nombre del cliente"
          name="name"
          required={true}
          help={errors.name?.message}
          validateStatus={errors.name ? "error" : undefined}
        >
          <Controller name="name" control={control} render={({ field }) => <Input id="name" autoComplete="off" data-testid="name" {...field} />} />
        </Form.Item>
        <div className="form-actions">
          <Button onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="submit">
              Guardar
            </Button>
          </AuthzHide>
        </div>
      </Form>
    </div>
  );
}
