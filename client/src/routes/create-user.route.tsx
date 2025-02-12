import { Button, Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "../hooks/api/users/use-create-user.mutation";
import { User } from "../shared/types/user/user";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { SaveOutlined } from "@ant-design/icons"; // Importar el icono
import { useEffect } from "react";

export default function CreateUserRoute() {
  const navigate = useNavigate();
  const { mutateAsync: createUser } = useCreateUserMutation();
  const { handleSubmit, control } = useForm<Omit<User, 'id_user'>>();

  useEffect(() => {
    document.title = "Crear Usuario";
  }, []);

  const submit: SubmitHandler<Omit<User, 'id_user'>> = async (values) => {
    try {
      await createUser(values);      
      navigate('/users');
    } catch {
      message.error('No se pudo guardar el formulario. Inténtalo de nuevo.');
    }
  }

  return (
    <Form layout="vertical" onFinish={handleSubmit(submit)}>
      <Form.Item name="name" label="Nombre" required={true}>
        <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
      </Form.Item>
      <Form.Item name="first_surname" label="Apellido 1" required={true}>
        <Controller name="first_surname" control={control} render={({ field }) => <Input {...field} />} />
      </Form.Item>
      <Form.Item name="second_surname" label="Apellido 2">
        <Controller name="second_surname" control={control} render={({ field }) => <Input {...field} />} />
      </Form.Item>
      <Form.Item name="dni" label="DNI" required={true}>
        <Controller name="dni" control={control} render={({ field }) => <Input {...field} />} />
      </Form.Item>
      <Form.Item name="phone" label="Teléfono">
        <Controller name="phone" control={control} render={({ field }) => <Input {...field} />} />
      </Form.Item>
      <Form.Item name="email" label="Email">
        <Controller name="email" control={control} render={({ field }) => <Input {...field}  />} />
      </Form.Item>
      <Form.Item name="moodle_username" label="Moodle Username">
        <Controller name="moodle_username" control={control} render={({ field }) => <Input {...field} />} />
      </Form.Item>
      <Form.Item name="moodle_password" label="Moodle Password">
        <Controller name="moodle_password" control={control} render={({ field }) => <Input.Password {...field} />} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
          Crear Usuario
        </Button>
      </Form.Item>
    </Form>
  );
}