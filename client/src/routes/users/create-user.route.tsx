import { Button, Form, Input, Checkbox, Select, Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "../../hooks/api/users/use-create-user.mutation";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { SaveOutlined } from "@ant-design/icons"; 
import { useEffect } from "react";
import { Gender } from "../../shared/types/user/gender.enum";
import { DocumentType } from "../../shared/types/user/document-type.enum";
import { zodResolver } from "@hookform/resolvers/zod"
import z from "zod";
import { DNI_SCHEMA } from "../../schemas/dni.schema";
import { detectDocumentType } from "../../utils/detect-document-type";

const CREATE_USER_FORM = z.object({
  name: z.string({ required_error: "El nombre es obligatorio" }).min(1, "El nombre no puede estar vacío"),
  first_surname: z.string({ required_error: "El primer apellido es obligatorio" }).min(1, "El primer apellido no puede estar vacío"),
  second_surname: z.string().optional(),
  email: z.string({ required_error: "El correo electrónico es obligatorio" }).email("El correo electrónico no es válido"),
  moodle_username: z.string().optional(),
  moodle_password: z.string().optional(),
  dni: DNI_SCHEMA,
  document_type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: "Tipo de documento no válido" }),
  }).optional(),
  phone: z.string().optional(),
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
  seasonalWorker: z.boolean().optional().default(false),
  erteLaw: z.boolean().optional().default(false),
  accreditationDiploma: z.enum(["S", "N"]).optional().default("N"),
});

export default function CreateUserRoute() {
  const navigate = useNavigate();
  const { mutateAsync: createUser } = useCreateUserMutation();
  const { handleSubmit, control, setValue, watch, formState: {errors} } = useForm({
    resolver: zodResolver(CREATE_USER_FORM)
  });
  const [modal, contextHolder] = Modal.useModal();

  // Detectar cambios en el campo dni y autocompletar document_type
  const dniValue = watch("dni");
  useEffect(() => {
    const detected = detectDocumentType(dniValue);
    if (detected) setValue("document_type", detected);
  }, [dniValue, setValue]);

  useEffect(() => {
    document.title = "Crear Usuario";
  }, []);

  const submit: SubmitHandler<z.infer<typeof CREATE_USER_FORM>> = async (values) => {
    try {
      await createUser(values);
      navigate('/users');
    } catch  {
      modal.error({
        title: "Error al crear el usuario",
        content: "Revise los datos e inténtelo de nuevo.",
      });
    }
  }

  return (
    <div>
      {contextHolder}
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Moodle Username" name="moodle_username" style={{ flex: 1 }}>
            <Controller name="moodle_username" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Contraseña Moodle" name="moodle_password" style={{ flex: 1 }}>
            <Controller name="moodle_password" control={control} render={({ field }) => <Input.Password {...field} />} />
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
          <Form.Item help={errors.dni?.message} validateStatus={errors.dni ? "error" : undefined} label="DNI" name="dni" style={{ flex: 1 }} required={true}>
            <Controller name="dni" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Nombre" name="name" style={{ flex: 2 }} required={true}>
            <Controller name="name" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Apellido 1" name="first_surname" style={{ flex: 2 }} required={true}>
            <Controller name="first_surname" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Apellido 2" name="second_surname" style={{ flex: 2 }}>
            <Controller name="second_surname" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Email" name="email" style={{ flex: 1 }} required={true}>
            <Controller name="email" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Teléfono" name="phone" style={{ flex: 1 }}>
            <Controller name="phone" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="Sexo" name="gender" style={{ flex: 1 }}>
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
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item name="seasonalWorker" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="seasonalWorker"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value}
                >
                  Trabajador fijo-discontinuo
                </Checkbox>
              )}
            />
          </Form.Item>
          <Form.Item name="erteLaw" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="erteLaw"
              control={control}
              render={({ field }) => (
                <Checkbox
                  {...field}
                  checked={field.value}
                >
                  ERTE RD Ley
                </Checkbox>
              )}
            />
          </Form.Item>
          <Form.Item name="accreditationDiploma" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="accreditationDiploma"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value === "S"}
                  onChange={e => field.onChange(e.target.checked ? "S" : "N")}
                >
                  Diploma acreditativo
                </Checkbox>
              )}
            />
          </Form.Item>
        </div>
        <Form.Item label="Observaciones" name="observations">
          <Controller name="observations" control={control} render={({ field }) => <Input.TextArea {...field} rows={3} />} />
        </Form.Item>
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