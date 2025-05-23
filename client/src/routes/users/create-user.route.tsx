import { Button, Form, Input, message, Checkbox, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "../../hooks/api/users/use-create-user.mutation";
import { User } from "../../shared/types/user/user";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { SaveOutlined } from "@ant-design/icons"; // Importar el icono
import { useEffect } from "react";
import { Gender } from "../../shared/types/user/gender.enum";
import { DocumentType } from "../../shared/types/user/document-type.enum";

export default function CreateUserRoute() {
  const navigate = useNavigate();
  const { mutateAsync: createUser } = useCreateUserMutation();
  const { handleSubmit, control } = useForm<Omit<User, 'id_user'>>({
    defaultValues: {
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
    },
  });

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
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Moodle Username" name="moodle_username" style={{ flex: 1 }}>
            <Controller name="moodle_username" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="DNI" name="dni" style={{ flex: 1 }} required={true}>
            <Controller name="dni" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Tipo Doc." name="document_type" style={{ flex: 1 }} required={true}>
            <Controller
              name="document_type"
              control={control}
              rules={{ required: "El tipo de documento es obligatorio" }}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Seleccione tipo"
                  status={fieldState.invalid ? "error" : undefined}
                >
                  <Select.Option value={DocumentType.DNI}>DNI</Select.Option>
                  <Select.Option value={DocumentType.NIE}>NIE</Select.Option>
                </Select>
              )}
            />
          </Form.Item>
          <Form.Item label="Nombre" name="name" style={{ flex: 2 }} required={true}>
            <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Apellidos" name="first_surname" style={{ flex: 2 }} required={true}>
            <Controller name="first_surname" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Email" name="email" style={{ flex: 1 }}>
            <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Teléfono" name="phone" style={{ flex: 1 }}>
            <Controller name="phone" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Sexo" name="gender" style={{ flex: 1 }} required={true}>
            <Controller
              name="gender"
              control={control}
              rules={{ required: "El sexo es obligatorio" }}
              render={({ field, fieldState }) => (
                <Select
                  {...field}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Seleccione sexo"
                  status={fieldState.invalid ? "error" : undefined}
                >
                  <Select.Option value={Gender.MALE}>Masculino</Select.Option>
                  <Select.Option value={Gender.FEMALE}>Femenino</Select.Option>
                  <Select.Option value={Gender.OTHER}>Otro</Select.Option>
                </Select>
              )}
            />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Dirección" name="address">
            <Controller name="address" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="País" name="country" style={{ flex: 1 }}>
            <Controller name="country" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Provincia" name="province" style={{ flex: 1 }}>
            <Controller name="province" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Ciudad" name="city" style={{ flex: 1 }}>
            <Controller name="city" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Código Postal" name="postal_code" style={{ flex: 1 }}>
            <Controller name="postal_code" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Categoría Profesional" name="professional_category" style={{ flex: 1 }}>
            <Controller name="professional_category" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Nivel Educativo" name="education_level" style={{ flex: 1 }}>
            <Controller name="education_level" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="NSS (Seguridad Social)" name="nss" style={{ flex: 1 }}>
            <Controller name="nss" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <Form.Item label="Observaciones" name="observations">
          <Controller name="observations" control={control} render={({ field }) => <Input.TextArea {...field} rows={3} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item name="disability" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="disability"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value}
                >
                  Discapacidad
                </Checkbox>
              )}
            />
          </Form.Item>
          <Form.Item name="terrorism_victim" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="terrorism_victim"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value}
                >
                  Víctima de Terrorismo
                </Checkbox>
              )}
            />
          </Form.Item>
          <Form.Item name="gender_violence_victim" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="gender_violence_victim"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value}
                >
                  Víctima de Violencia de Género
                </Checkbox>
              )}
            />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
          <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Crear Usuario
          </Button>
        </div>
      </Form>
    </div>
  );
}