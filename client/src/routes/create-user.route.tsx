import { Button, Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "../hooks/api/users/use-create-user.mutation";
import { User } from "../shared/types/user/user";
import { useForm, Controller, SubmitHandler } from "react-hook-form";

export default function CreateUserRoute() {
  const navigate = useNavigate();
  const { mutateAsync: createUser } = useCreateUserMutation();
  const { handleSubmit, control } = useForm<Omit<User, 'id_user'>>();

 
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
      <Form.Item name="surname" label="Apellidos" required={true}>
        <Controller name="surname" control={control} render={({ field }) => <Input {...field} />} />
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
        <Button type="primary" htmlType="submit">
          Crear Usuario
        </Button>
      </Form.Item>
    </Form>
  );
}