import { Button, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "../hooks/api/users/use-create-user.mutation";
import { User } from "../shared/types/user/user";

export default function CreateUserRoute() {
  const navigate = useNavigate();
  const { mutate: createUser } = useCreateUserMutation();

  const onFinish = (values: Omit<User, 'id_user'>) => {
    createUser(values, {
      onSuccess: () => {
        navigate('/users');
      }
    });
  };

  return (
    <Form onFinish={onFinish} layout="vertical">
      <Form.Item name="name" label="Nombre" rules={[{ 
        required: true,
        message: 'Por favor, introduce un nombre'        
        }]}>
        <Input />
      </Form.Item>
      <Form.Item name="surname" label="Apellidos" rules={[{ 
        required: true,
        message: 'Por favor, introduce un apellido'
        }]}>
        <Input />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ 
        required: true, 
        type: 'email', 
        message: 'Por favor, introduce un email válido'
       }]}>
        <Input />
      </Form.Item>
      <Form.Item name="moodle_username" label="Moodle Username">
        <Input />
      </Form.Item>
      <Form.Item name="moodle_password" label="Moodle Password">
        <Input.Password />
      </Form.Item>
      <Form.Item name="moodle_id" label="Moodle ID">
        <Input />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Crear Usuario
        </Button>
      </Form.Item>
    </Form>
  );
}