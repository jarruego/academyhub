import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUserQuery } from "../../hooks/api/users/use-user.query";
import { useUpdateUserMutation } from "../../hooks/api/users/use-update-user.mutation";
import { useDeleteUserMutation } from "../../hooks/api/users/use-delete-user.mutation";
import { Button, Form, Input, message, Checkbox, Select } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useEffect } from "react";
import { detectDocumentType } from "../../utils/detect-document-type";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { DocumentType } from "../../shared/types/user/document-type.enum";
import { Gender } from "../../shared/types/user/gender.enum";
import { DNI_SCHEMA } from "../../schemas/dni.schema";

const USER_FORM_SCHEMA = z.object({
  id_user: z.number(),
  name: z.string({ required_error: "El nombre es obligatorio" }).min(1, "El nombre no puede estar vacío"),
  first_surname: z.string({ required_error: "El primer apellido es obligatorio" }).min(1, "El primer apellido no puede estar vacío"),
  second_surname: z.string().optional(),
  email: z.string({ required_error: "El correo electrónico es obligatorio" }).email("El correo electrónico no es válido"),
  moodle_username: z.string().optional(),
  moodle_password: z.string().optional(),
  dni: DNI_SCHEMA.optional(),
  document_type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: "Tipo de documento no válido" }),
  }).optional(),
  phone: z.string({ required_error: "El teléfono es obligatorio" }),
  address: z.string().optional(),
  professional_category: z.string().optional(),
  disability: z.boolean().optional().default(false),
  terrorism_victim: z.boolean().optional().default(false),
  gender_violence_victim: z.boolean().optional().default(false),
  gender: z.nativeEnum(Gender, {
    errorMap: () => ({ message: "Género no válido" }),
  }).optional(),
  education_level: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  observations: z.string().optional(),
  registration_date: z.date({ invalid_type_error: "La fecha de registro debe ser una fecha válida" }).optional(),
  nss: z.string().optional(),
});

export default function UserDetailRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id_user } = useParams();
  const { data: userData, isLoading: isUserLoading } = useUserQuery(id_user || "");
  const { mutateAsync: updateUser } = useUpdateUserMutation(id_user || "");
  const { mutateAsync: deleteUser } = useDeleteUserMutation(id_user || "");

  const { handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(USER_FORM_SCHEMA)
  });

  // Mostrar errores de validación por consola
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("Errores de validación:", errors);
    }
  }, [errors]);

  // Detectar cambios en el campo dni y autocompletar document_type
  const dniValue = watch("dni");
  useEffect(() => {
    const detected = detectDocumentType(dniValue ?? "");
    setValue("document_type", detected ?? undefined);
  }, [dniValue, setValue]);

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

  const submit: SubmitHandler<z.infer<typeof USER_FORM_SCHEMA>> = async (info) => {
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
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="ID" name="id_user" style={{ flex: 1 }}>
            <Controller name="id_user" control={control} render={({ field }) => <Input {...field} disabled />} />
          </Form.Item>
          <Form.Item label="Nombre" name="name" style={{ flex: 2 }} help={errors.name?.message} validateStatus={errors.name ? "error" : undefined}>
            <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Apellido 1" name="first_surname" style={{ flex: 2 }} help={errors.first_surname?.message} validateStatus={errors.first_surname ? "error" : undefined}>
            <Controller name="first_surname" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Apellido 2" name="second_surname" style={{ flex: 2 }}>
            <Controller name="second_surname" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Tipo Doc." name="document_type" style={{ flex: 1 }}>
            <Controller
              name="document_type"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  value={field.value ?? undefined}
                  disabled
                  placeholder="Auto"
                  allowClear
                >
                  <Select.Option value={DocumentType.DNI}>DNI</Select.Option>
                  <Select.Option value={DocumentType.NIE}>NIE</Select.Option>
                </Select>
              )}
            />
          </Form.Item>
          <Form.Item label="DNI" name="dni" style={{ flex: 1 }}>
            <Controller name="dni" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Moodle Username" name="moodle_username" style={{ flex: 1 }}>
            <Controller name="moodle_username" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Contraseña Moodle" name="moodle_password" style={{ flex: 2 }}>
            <Controller name="moodle_password" control={control} render={({ field }) => <Input.Password {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Email" name="email" style={{ flex: 1 }}>
            <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Teléfono" name="phone" style={{ flex: 1 }}>
            <Controller name="phone" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Sexo" name="gender" style={{ flex: 1 }}>
            <Controller
              name="gender"
              control={control}
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
        <Form.Item label="Dirección" name="address">
          <Controller name="address" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Código Postal" name="postal_code" style={{ flex: 1 }}>
            <Controller name="postal_code" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Ciudad" name="city" style={{ flex: 1 }}>
            <Controller name="city" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Provincia" name="province" style={{ flex: 1 }}>
            <Controller name="province" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="País" name="country" style={{ flex: 1 }}>
            <Controller name="country" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="NSS (Seguridad Social)" name="nss" style={{ flex: 1 }}>
            <Controller name="nss" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Categoría Profesional" name="professional_category" style={{ flex: 1 }}>
            <Controller name="professional_category" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Nivel Educativo" name="education_level" style={{ flex: 1 }}>
            <Controller name="education_level" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
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
        <Form.Item label="Observaciones" name="observations">
          <Controller name="observations" control={control} render={({ field }) => <Input.TextArea {...field} rows={3} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
          <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="primary" htmlType="submit">Guardar</Button>
          <Button type="primary" danger onClick={handleDelete}>Eliminar Usuario</Button>
        </div>
      </Form>
    </div>
  );
}
