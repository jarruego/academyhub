import { Button, Form, Input, Checkbox, Select, Modal, DatePicker } from "antd";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "../../hooks/api/users/use-create-user.mutation";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { SaveOutlined } from "@ant-design/icons"; 
import { useEffect } from "react";
import { Gender } from "../../shared/types/user/gender.enum";
import { DocumentType } from "../../shared/types/user/document-type.enum";
import { zodResolver } from "@hookform/resolvers/zod"
import z from "zod";
import dayjs from "dayjs";
import { DNI_SCHEMA } from "../../schemas/dni.schema";
import { detectDocumentType } from "../../utils/detect-document-type";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const CREATE_USER_FORM = z.object({
  name: z.string({ required_error: "El nombre es obligatorio" }).min(1, "El nombre no puede estar vacío"),
  first_surname: z.string({ required_error: "El primer apellido es obligatorio" }).min(1, "El primer apellido no puede estar vacío"),
  second_surname: z.string().optional(),
  email: z.string({ required_error: "El correo electrónico es obligatorio" }).email("El correo electrónico no es válido"),
  dni: DNI_SCHEMA,
  document_type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: "Tipo de documento no válido" }),
  }).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  professional_category: z.string().optional(),
  salary_group: z.number().int().positive().optional(),
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
  registration_date: z.date().optional().nullable(),
  birth_date: z.date().optional().nullable(),
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
      await createUser({
        ...values,
        birth_date: values.birth_date ? dayjs(values.birth_date).utc().toDate() : null,
        registration_date: values.registration_date ? dayjs(values.registration_date).utc().toDate() : null,
      });
      navigate('/users');
    } catch (error) {
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
            <Controller name="dni" control={control} render={({ field }) => <Input data-testid="dni" {...field} />} />
          </Form.Item>
          <Form.Item label="Nombre" name="name" style={{ flex: 2 }} required={true}>
            <Controller name="name" control={control} render={({ field }) => <Input data-testid="name" {...field} />} />
          </Form.Item>
          <Form.Item label="Apellido 1" name="first_surname" style={{ flex: 2 }} required={true}>
            <Controller name="first_surname" control={control} render={({ field }) => <Input data-testid="first-surname" {...field} />} />
          </Form.Item>
          <Form.Item label="Apellido 2" name="second_surname" style={{ flex: 2 }}>
            <Controller name="second_surname" control={control} render={({ field }) => <Input data-testid="second-surname" {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Email" name="email" style={{ flex: 1 }} required={true}>
            <Controller name="email" control={control} render={({ field }) => <Input data-testid="email" {...field} />} />
          </Form.Item>
          <Form.Item label="Teléfono" name="phone" style={{ flex: 1 }}>
            <Controller name="phone" control={control} render={({ field }) => <Input data-testid="phone" {...field} />} />
          </Form.Item>
          <Form.Item label="Sexo" name="gender" style={{ flex: 1 }}>
            <Controller
              name="gender"
              control={control}
              rules={{ required: "El sexo es obligatorio" }}
              render={({ field, fieldState }) => (
                <Select
                  data-testid="gender"
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
          <Form.Item 
            label="Fecha de nacimiento" 
            name="birth_date" 
            style={{ flex: 1 }}
            help={errors.birth_date?.message}
            validateStatus={errors.birth_date ? "error" : undefined}
          >
            <Controller 
              name="birth_date" 
              control={control} 
              render={({ field }) => (
                <DatePicker 
                  {...field} 
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(date) => field.onChange(date ? date.toDate() : null)}
                  data-testid="birth-date" 
                />
              )}
            />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Dirección" name="address">
            <Controller name="address" control={control} render={({ field }) => <Input data-testid="address" {...field} />} />
          </Form.Item>
          <Form.Item label="País" name="country" style={{ flex: 1 }}>
            <Controller name="country" control={control} render={({ field }) => <Input data-testid="country" {...field} />} />
          </Form.Item>
          <Form.Item label="Provincia" name="province" style={{ flex: 1 }}>
            <Controller name="province" control={control} render={({ field }) => <Input data-testid="province" {...field} />} />
          </Form.Item>
          <Form.Item label="Ciudad" name="city" style={{ flex: 1 }}>
            <Controller name="city" control={control} render={({ field }) => <Input data-testid="city" {...field} />} />
          </Form.Item>
          <Form.Item label="Código Postal" name="postal_code" style={{ flex: 1 }}>
            <Controller name="postal_code" control={control} render={({ field }) => <Input data-testid="postal-code" {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Categoría Profesional" name="professional_category" style={{ flex: 1 }}>
            <Controller name="professional_category" control={control} render={({ field }) => <Input data-testid="professional-category" {...field} />} />
          </Form.Item>
          <Form.Item label="Grupo de Cotización" name="salary_group" style={{ flex: 1 }}>
            <Controller name="salary_group" control={control} render={({ field }) => (
              <Input 
                type="number" 
                data-testid="salary-group" 
                {...field} 
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              />
            )} />
          </Form.Item>
          <Form.Item label="Nivel Educativo" name="education_level" style={{ flex: 1 }}>
            <Controller name="education_level" control={control} render={({ field }) => <Input data-testid="education-level" {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="NSS (Seguridad Social)" name="nss" style={{ flex: 1 }}>
            <Controller name="nss" control={control} render={({ field }) => <Input data-testid="nss" {...field} />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item name="disability" valuePropName="checked" style={{ flex: 1 }}>
            <Controller
              name="disability"
              control={control}
              render={({ field }) => (
                <Checkbox
                  data-testid="disability"
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
                  data-testid="terrorism-victim"
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
                  data-testid="gender-violence-victim"
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
                  data-testid="seasonal-worker"
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
                  data-testid="erte-law"
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
                  data-testid="accreditation-diploma"
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
          <Controller name="observations" control={control} render={({ field }) => <Input.TextArea data-testid="observations" {...field} rows={3} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
          <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
          <AuthzHide roles={[Role.ADMIN]}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="submit">
              Crear Usuario
            </Button>
          </AuthzHide>
        </div>
      </Form>
    </div>
  );
}