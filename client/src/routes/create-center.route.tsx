import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message } from "antd";
import { useCreateCenterMutation } from "../hooks/api/centers/use-create-center.mutation";
import { Center } from "../shared/types/center/center";
import { SaveOutlined } from "@ant-design/icons";
import { useEffect } from "react";

export default function CreateCenterRoute() {
  const { id_company } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: createCenter } = useCreateCenterMutation();
  const { handleSubmit, control } = useForm<Omit<Center, 'id_center'>>();

  useEffect(() => {
    document.title = "Crear Centro";
  }, []);

  const submit: SubmitHandler<Omit<Center, 'id_center'>> = async (data) => {
    try {
      await createCenter({ ...data, id_company: Number(id_company) });
      message.success('Centro creado exitosamente');
      navigate(`/companies/${id_company}`);
    } catch {
      message.error('No se pudo crear el centro');
    }
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item label="ID de la empresa" name="id_company">
          <Controller name="id_company" control={control} render={({ field }) => <Input {...field} value={id_company} disabled />} />
        </Form.Item>
        <Form.Item label="Nombre del centro" name="center_name">
          <Controller name="center_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Número de empleados" name="employer_number">
          <Controller name="employer_number" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Persona de contacto" name="contact_person">
          <Controller name="contact_person" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Teléfono de contacto" name="contact_phone">
          <Controller name="contact_phone" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Email de contacto" name="contact_email">
          <Controller name="contact_email" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Guardar
          </Button>
        </div>
      </Form>
    </div>
  );
}
