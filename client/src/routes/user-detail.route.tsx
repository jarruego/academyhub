import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUserQuery } from "../hooks/api/users/use-user.query";
import { useUpdateUserMutation } from "../hooks/api/users/use-update-user.mutation";
import { useDeleteUserMutation } from "../hooks/api/users/use-delete-user.mutation";
import { Button, Form, Input, message } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useEffect } from "react";
import { User } from "../shared/types/user/user";

export default function UserDetailRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id_user } = useParams();
  const { data: userData, isLoading: isUserLoading } = useUserQuery(id_user || "");
  const { mutateAsync: updateUser } = useUpdateUserMutation(id_user || "");
  const { mutateAsync: deleteUser } = useDeleteUserMutation(id_user || "");

  const { handleSubmit, control, reset } = useForm<User>();

  useEffect(() => {
    if (userData) {
      reset(userData);
    }
  }, [userData, reset]);

  useEffect(() => {
    document.title = `Detalles del Usuario ${id_user}`;
  }, [id_user]);

  if (!userData) return <div>Usuario no encontrado</div>;
  if (isUserLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<User> = async (info) => {
    try {
      await updateUser(info);
      navigate(location.state?.from || '/users');
    } catch {
      message.error('No se pudo guardar el usuario.');
    }
  }

  const handleDelete = async () => {
    try {
      await deleteUser();
      navigate('/users');
    } catch {
      message.error('No se pudo eliminar el usuario.');
    }
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item label="ID" name="id_user">
          <Controller name="id_user" control={control} render={({ field }) => <Input {...field} disabled />} />
        </Form.Item>
        <Form.Item label="Nombre" name="name">
          <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Apellidos" name="surname">
          <Controller name="surname" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Email" name="email">
          <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Moodle Username" name="moodle_username">
          <Controller name="moodle_username" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">Guardar</Button>
        </Form.Item>
      </Form>
      <Button type="primary" danger onClick={handleDelete} style={{ marginTop: '16px' }}>
        Eliminar Usuario
      </Button>
    </div>
  );
}
