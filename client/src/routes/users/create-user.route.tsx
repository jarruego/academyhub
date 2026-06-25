import { App, Button, Form, Input, Checkbox, Select, DatePicker, Row, Col } from "antd";
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
import { SALARY_GROUP_OPTIONS, EDUCATION_LEVEL_OPTIONS } from '../../constants/options/user-options';

const CREATE_USER_FORM = z.object({
  name: z.string({ required_error: "El nombre es obligatorio" }).min(1, "El nombre no puede estar vacío"),
  first_surname: z.string({ required_error: "El primer apellido es obligatorio" }).min(1, "El primer apellido no puede estar vacío"),
  second_surname: z.string().optional(),
  email: z.string().email("El correo electrónico no es válido").optional().or(z.literal("")),
  dni: DNI_SCHEMA,
  document_type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: "Tipo de documento no válido" }),
  }).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  job_position: z.string().optional(),
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
  const { modal } = App.useApp();

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
      const created = await createUser({
        ...values,
        birth_date: values.birth_date ? dayjs(values.birth_date).utc().toDate() : null,
        registration_date: values.registration_date ? dayjs(values.registration_date).utc().toDate() : null,
      });
      if (created?.id_user) {
        navigate(`/users/${created.id_user}`);
        return;
      }
      navigate('/users');
    } catch {
      modal.error({
        title: "Error al crear el usuario",
        content: "Revise los datos e inténtelo de nuevo.",
      });
    }
  }

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>

        {/* Identificación */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8} md={3}>
            <Form.Item label="Tipo Doc." name="document_type">
              <Controller
                name="document_type"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="document_type"
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
          </Col>
          <Col xs={24} sm={8} md={3}>
            <Form.Item
              help={errors.dni?.message}
              validateStatus={errors.dni ? "error" : undefined}
              label="DNI"
              name="dni"
              required
            >
              <Controller name="dni" control={control} render={({ field }) => <Input data-testid="dni" id="dni" autoComplete="off" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Form.Item label="Nombre" name="name" required>
              <Controller name="name" control={control} render={({ field }) => <Input data-testid="name" id="name" autoComplete="given-name" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Apellido 1" name="first_surname" required>
              <Controller name="first_surname" control={control} render={({ field }) => <Input data-testid="first-surname" id="first_surname" autoComplete="family-name" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Apellido 2" name="second_surname">
              <Controller name="second_surname" control={control} render={({ field }) => <Input data-testid="second-surname" id="second_surname" autoComplete="additional-name" {...field} />} />
            </Form.Item>
          </Col>
        </Row>

        {/* Contacto y sexo */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8} md={8}>
            <Form.Item label="Email" name="email">
              <Controller name="email" control={control} render={({ field }) => <Input data-testid="email" id="email" autoComplete="email" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Form.Item label="Teléfono" name="phone">
              <Controller name="phone" control={control} render={({ field }) => <Input data-testid="phone" id="phone" autoComplete="tel" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Form.Item label="Sexo" name="gender">
              <Controller
                name="gender"
                control={control}
                rules={{ required: "El sexo es obligatorio" }}
                render={({ field, fieldState }) => (
                  <Select
                    data-testid="gender"
                    {...field}
                    id="gender"
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
          </Col>
        </Row>

        {/* Fecha de nacimiento */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Fecha de nacimiento"
              name="birth_date"
              help={errors.birth_date?.message}
              validateStatus={errors.birth_date ? "error" : undefined}
            >
              <Controller
                name="birth_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="birth_date"
                    style={{ width: '100%' }}
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(date) => field.onChange(date ? date.toDate() : null)}
                    data-testid="birth-date"
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Dirección */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={24} md={8}>
            <Form.Item label="Dirección" name="address">
              <Controller name="address" control={control} render={({ field }) => <Input data-testid="address" id="address" autoComplete="street-address" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item label="País" name="country">
              <Controller name="country" control={control} render={({ field }) => <Input data-testid="country" id="country" autoComplete="country-name" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item label="Provincia" name="province">
              <Controller name="province" control={control} render={({ field }) => <Input data-testid="province" id="province" autoComplete="address-level1" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item label="Ciudad" name="city">
              <Controller name="city" control={control} render={({ field }) => <Input data-testid="city" id="city" autoComplete="address-level2" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item label="Código Postal" name="postal_code">
              <Controller name="postal_code" control={control} render={({ field }) => <Input data-testid="postal-code" id="postal_code" autoComplete="postal-code" {...field} />} />
            </Form.Item>
          </Col>
        </Row>

        {/* Datos laborales */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={24} md={8}>
            <Form.Item label="Puesto de trabajo" name="job_position">
              <Controller name="job_position" control={control} render={({ field }) => <Input data-testid="job-position" id="job_position" autoComplete="organization-title" {...field} />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Grupo de Cotización" name="salary_group">
              <Controller
                name="salary_group"
                control={control}
                render={({ field }) => {
                  const options = SALARY_GROUP_OPTIONS;
                  const currentValue = typeof field.value === 'number' ? field.value : (field.value ? Number(field.value) : undefined);
                  return (
                    <Select
                      {...field}
                      data-testid="salary-group"
                      id="salary_group"
                      value={currentValue}
                      onChange={(val) => {
                        if (typeof val === 'undefined' || val === null) field.onChange(undefined);
                        else field.onChange(Number(val));
                      }}
                      allowClear
                      placeholder="Selecciona grupo de cotización"
                    >
                      {options.map(o => (
                        <Select.Option key={o.value} value={o.value}>
                          {o.label}
                        </Select.Option>
                      ))}
                    </Select>
                  );
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Nivel Educativo" name="education_level">
              <Controller
                name="education_level"
                control={control}
                render={({ field }) => {
                  const options = EDUCATION_LEVEL_OPTIONS;
                  const currentValue = typeof field.value === 'number' ? field.value : (field.value ? Number(field.value) : undefined);
                  return (
                    <Select
                      {...field}
                      data-testid="education-level"
                      id="education_level"
                      value={currentValue}
                      onChange={(val) => {
                        if (typeof val === 'undefined' || val === null) field.onChange(undefined);
                        else field.onChange(Number(val));
                      }}
                      allowClear
                      placeholder="Selecciona nivel educativo"
                    >
                      {options.map(o => (
                        <Select.Option key={o.value} value={o.value}>
                          {o.label}
                        </Select.Option>
                      ))}
                    </Select>
                  );
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* NSS */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="NSS (Seguridad Social)" name="nss">
              <Controller name="nss" control={control} render={({ field }) => <Input data-testid="nss" id="nss" autoComplete="off" {...field} />} />
            </Form.Item>
          </Col>
        </Row>

        {/* Colectivos especiales */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8} md={8}>
            <Form.Item name="disability" valuePropName="checked">
              <Controller
                name="disability"
                control={control}
                render={({ field }) => (
                  <Checkbox data-testid="disability" {...field} id="disability" checked={field.value}>
                    Discapacidad
                  </Checkbox>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Form.Item name="terrorism_victim" valuePropName="checked">
              <Controller
                name="terrorism_victim"
                control={control}
                render={({ field }) => (
                  <Checkbox data-testid="terrorism-victim" {...field} id="terrorism_victim" checked={field.value}>
                    Víctima de Terrorismo
                  </Checkbox>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Form.Item name="gender_violence_victim" valuePropName="checked">
              <Controller
                name="gender_violence_victim"
                control={control}
                render={({ field }) => (
                  <Checkbox data-testid="gender-violence-victim" {...field} id="gender_violence_victim" checked={field.value}>
                    Víctima de Violencia de Género
                  </Checkbox>
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Condiciones laborales */}
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8} md={8}>
            <Form.Item name="seasonalWorker" valuePropName="checked">
              <Controller
                name="seasonalWorker"
                control={control}
                render={({ field }) => (
                  <Checkbox data-testid="seasonal-worker" {...field} id="seasonalWorker" checked={field.value}>
                    Trabajador fijo-discontinuo
                  </Checkbox>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Form.Item name="erteLaw" valuePropName="checked">
              <Controller
                name="erteLaw"
                control={control}
                render={({ field }) => (
                  <Checkbox data-testid="erte-law" {...field} id="erteLaw" checked={field.value}>
                    ERTE RD Ley
                  </Checkbox>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={8}>
            <Form.Item name="accreditationDiploma" valuePropName="checked">
              <Controller
                name="accreditationDiploma"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    data-testid="accreditation-diploma"
                    id="accreditationDiploma"
                    checked={field.value === "S"}
                    onChange={e => field.onChange(e.target.checked ? "S" : "N")}
                  >
                    Diploma acreditativo
                  </Checkbox>
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Observaciones" name="observations">
          <Controller name="observations" control={control} render={({ field }) => <Input.TextArea data-testid="observations" id="observations" autoComplete="off" {...field} rows={3} />} />
        </Form.Item>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
