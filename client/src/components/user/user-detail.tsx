import { useNavigate, useLocation } from "react-router-dom";
import { useUserQuery } from "../../hooks/api/users/use-user.query";
import { useUpdateUserWithMoodleMutation } from "../../hooks/api/users/use-update-user-with-moodle.mutation";
import { useDeleteUserMutation } from "../../hooks/api/users/use-delete-user.mutation";
import { useMoodleUsersByUserIdQuery } from "../../hooks/api/moodle-users/use-moodle-users-by-user-id.query";
import { useUserCoursesQuery } from "../../hooks/api/users/use-user-courses.query";
import { Button, Form, Input, Modal, Checkbox, Select, Tabs, DatePicker } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useEffect, useState } from "react";
// composed hook will handle moodle updates when saving a user
import { detectDocumentType } from "../../utils/detect-document-type";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import dayjs from "dayjs";
import { DNI_SCHEMA } from "../../schemas/dni.schema";
import { Gender } from "../../shared/types/user/gender.enum";
import { DocumentType } from "../../shared/types/user/document-type.enum";
import { AddUserToCenterSection } from "../../routes/users/user-center-detail-section";
import { MoodleUsersSection } from "./moodle-users-section";
import { UserCoursesSection } from "./user-courses-section";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { SALARY_GROUP_OPTIONS, EDUCATION_LEVEL_OPTIONS } from '../../constants/options/user-options';


function nullsToUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(nullsToUndefined) as unknown as T;
  } else if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : nullsToUndefined(v)])
    ) as T;
  }
  return obj;
}

const USER_FORM_SCHEMA = z.object({
  id_user: z.number(),
  name: z.string({ required_error: "El nombre es obligatorio" }).min(1, "El nombre no puede estar vacío"),
  first_surname: z.string({ required_error: "El primer apellido es obligatorio" }).min(1, "El primer apellido no puede estar vacío"),
  second_surname: z.string().nullish(),
  moodle_username: z.string().nullish(),
  moodle_password: z.string().nullish(),
  email: z.string().email("El correo electrónico no es válido").optional().or(z.literal("")),
  dni: DNI_SCHEMA.nullish(),
  document_type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: "Tipo de documento no válido" }),
  }).nullish(),
  phone: z.string({ required_error: "El teléfono es obligatorio" }).nullish(),
  address: z.string().nullish(),
  professional_category: z.string().nullish(),
  salary_group: z.number().int().positive().nullish(),
  disability: z.boolean().nullish().default(false),
  terrorism_victim: z.boolean().nullish().default(false),
  gender_violence_victim: z.boolean().nullish().default(false),
  gender: z.nativeEnum(Gender, {
    errorMap: () => ({ message: "Género no válido" }),
  }).nullish(),
  // education_level may be stored as a string in the backend but in the UI
  // we accept a numeric code 1..10. Accept both string and number here so
  // the zod resolver won't reject existing string values coming from the API.
  education_level: z.union([z.string(), z.number().int().min(1).max(10)]).nullish(),
  postal_code: z.string().nullish(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  country: z.string().nullish(),
  observations: z.string().nullish(),
  registration_date: z.date({ invalid_type_error: "La fecha de registro debe ser una fecha válida" }).nullish(),
  birth_date: z.date().optional().nullable(),
  nss: z.string().nullish(),
  seasonalWorker: z.boolean().nullish().default(false),
  erteLaw: z.boolean().nullish().default(false),
  accreditationDiploma: z.union([z.literal("S"), z.literal("N"), z.null()]).nullish().default("N"),
});

type Props = {
    userId: number;
}

export default function UserDetail({ userId }: Props) {
const navigate = useNavigate();
  const location = useLocation();
  
  const [modal, contextHolder] = Modal.useModal();

  // Lee el parámetro 'tab' de la URL
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");
  const defaultActiveKey = tabParam === "centers" ? "2" : "1";

  const {
    data: userData,
    isLoading: isUserLoading
  } = useUserQuery(userId);
  const { mutateAsync: updateUserWithMoodle } = useUpdateUserWithMoodleMutation(userId);
  const { mutateAsync: deleteUser } = useDeleteUserMutation(userId);
  const { 
    data: moodleUsers
  } = useMoodleUsersByUserIdQuery(userId);
  const { 
    data: userCourses
  } = useUserCoursesQuery(userId);
  const { handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(USER_FORM_SCHEMA)
  });

  const [moodleUsername, setMoodleUsername] = useState<string | undefined>(undefined);
  const [moodlePassword, setMoodlePassword] = useState<string | undefined>(undefined);
  // Moodle updates are handled by the composed hook

  // Detectar cambios en el campo dni y autocompletar document_type
  const dniValue = watch("dni");
  useEffect(() => {
    const detected = detectDocumentType(dniValue ?? "");
    setValue("document_type", detected ?? undefined);
  }, [dniValue, setValue]);

  // Watch salary_group and education_level to show inline guidance when not specified
  const salaryGroupValue = watch("salary_group");
  const educationLevelValue = watch("education_level");
  useEffect(() => {
    if (userData) {
      let diploma: "S" | "N" | null = null;
      if (userData.accreditationDiploma === "S") diploma = "S";
      else if (userData.accreditationDiploma === "N") diploma = "N";
      const normalized = {
        ...nullsToUndefined(userData),
        accreditationDiploma: diploma,
        birth_date: userData.birth_date ? new Date(userData.birth_date) : null,
        registration_date: userData.registration_date ? new Date(userData.registration_date) : null,
      };
      reset(normalized);
    }
  }, [userData, reset]);

  // initialize moodle fields from main moodle user when moodleUsers change
  useEffect(() => {
    if (moodleUsers && moodleUsers.length > 0) {
      const main = moodleUsers.find(mu => (mu as any).is_main_user) || moodleUsers[0];
      setMoodleUsername(main?.moodle_username ?? undefined);
      setMoodlePassword(main?.moodle_password ?? undefined);
    } else {
      setMoodleUsername(undefined);
      setMoodlePassword(undefined);
    }
  }, [moodleUsers]);

  useEffect(() => {
    const prevTitle = document.title;
    if (userData) {
      const fullName = `${userData.name ?? ''} ${userData.first_surname ?? ''}${userData.second_surname ? ' ' + userData.second_surname : ''}`.trim();
      document.title = fullName || `Detalles del Usuario ${userId}`;
    } else {
      document.title = `Usuario ${userId}`;
    }
    return () => { document.title = prevTitle; };
  }, [userData, userId]);

  if (!userData) return <div>Usuario no encontrado</div>;
  if (isUserLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<z.infer<typeof USER_FORM_SCHEMA>> = async (info) => {
    const performSave = async () => {
      const normalizedInfo = {
        ...nullsToUndefined(info),
        birth_date: info.birth_date ? dayjs(info.birth_date).utc().toDate() : null,
        registration_date: info.registration_date ? dayjs(info.registration_date).utc().toDate() : null,
        email: info.email ?? "",
      } as Record<string, unknown>;
      // If the salary_group field was explicitly cleared in the form (null),
      // preserve that intent and send `salary_group: null` to the API so the
      // backend can clear the value. `nullsToUndefined` removes nulls, so we
      // must re-insert null explicitly here when appropriate.
      if (info.salary_group === null) {
        (normalizedInfo as any).salary_group = null;
      }
      // Ensure education_level is sent as string (backend stores it as text)
      if (info.education_level === null || typeof info.education_level === 'undefined') {
        (normalizedInfo as any).education_level = null;
      } else {
        (normalizedInfo as any).education_level = String(info.education_level);
      }

      try {
        await updateUserWithMoodle({
          userInfo: normalizedInfo,
          moodleUsername: moodleUsername ?? null,
          moodlePassword: moodlePassword ?? null,
          moodleUsers,
        });
        navigate(location.state?.from || '/users');
      } catch (err: any) {
        // Distinguish errors coming from moodle update
        if (err && (err as any).type === 'moodle') {
          modal.error({ title: 'Error al actualizar Moodle', content: 'Se produjo un error al actualizar la cuenta de Moodle asociada. Revisa los logs del servidor.' });
          return; // keep user on page so they can inspect
        }
        modal.error({
          title: "Error al guardar el usuario",
          content: "No se pudo guardar el usuario. Revise los datos e inténtelo de nuevo. ¿DNI repetido?",
        });
      }
    };

    // If salary_group or education_level not specified, ask for confirmation before saving
    const missing: string[] = [];
    if (info.salary_group == null) missing.push('Grupo de cotización');
    if (info.education_level == null) missing.push('Nivel educativo');

    if (missing.length > 0) {
      modal.confirm({
        title: 'Campos no especificados',
        content: (`Los siguientes campos no están especificados: ${missing.join(', ')}.` +
          ' ¿Desea continuar y guardar sin asignar estos valores?'),
        okText: 'Sí, guardar',
        cancelText: 'Cancelar',
        onOk: async () => {
          await performSave();
        }
      });
      return;
    }

    // Normal save path
    await performSave();
  };

  const handleDelete = async () => {
    modal.confirm({
      title: "¿Seguro que desea eliminar este usuario?",
      content: "Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteUser();
          navigate('/users');
        } catch {
          modal.error({
            title: "Error al eliminar el usuario",
            content: "No se pudo eliminar el usuario. Inténtelo de nuevo.",
          });
        }
      },
    });
  };

  const items = [
    {
      key: "1",
      label: "Datos Usuario",
      children: (
        <Form layout="vertical" onFinish={handleSubmit(submit)}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item label="ID" name="id_user" style={{ flex: 1 }}>
              <Controller name="id_user" control={control} render={({ field }) => <Input {...field} id="id_user" autoComplete="off" disabled data-testid="user-id" />} />
            </Form.Item>
            <Form.Item label="Nombre" name="name" style={{ flex: 2 }} help={errors.name?.message} validateStatus={errors.name ? "error" : undefined}>
              <Controller name="name" control={control} render={({ field }) => <Input {...field} id="name" autoComplete="given-name" data-testid="user-name" />} />
            </Form.Item>
            <Form.Item label="Apellido 1" name="first_surname" style={{ flex: 2 }} help={errors.first_surname?.message} validateStatus={errors.first_surname ? "error" : undefined}>
              <Controller name="first_surname" control={control} render={({ field }) => <Input {...field} id="first_surname" autoComplete="family-name" data-testid="user-first-surname" />} />
            </Form.Item>
            <Form.Item label="Apellido 2" name="second_surname" style={{ flex: 2 }}>
              <Controller name="second_surname" control={control} render={({ field }) => <Input {...field} id="second_surname" autoComplete="additional-name" value={field.value ?? undefined} />} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <Form.Item label="Tipo Doc." name="document_type" style={{ width: '10ch' }}>
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
                    style={{ width: '100%' }}
                  >
                    <Select.Option value={DocumentType.DNI}>DNI</Select.Option>
                    <Select.Option value={DocumentType.NIE}>NIE</Select.Option>
                  </Select>
                )}
              />
            </Form.Item>
            <Form.Item label="DNI" name="dni" style={{ width: '15ch' }}>
              <Controller name="dni" control={control} render={({ field }) => <Input {...field} id="dni" autoComplete="off" value={field.value ?? undefined} style={{ width: '100%' }} />} />
            </Form.Item>
            <Form.Item label="NSS (Seg.Social)" name="nss" style={{ width: '20ch' }}>
              <Controller name="nss" control={control} render={({ field }) => <Input {...field} id="nss" autoComplete="off" value={field.value ?? undefined} style={{ width: '100%' }} />} />
            </Form.Item>
            <Form.Item label="Categoría Profesional" name="professional_category" style={{ flex: 1 }}>
              <Controller name="professional_category" control={control} render={({ field }) => <Input {...field} id="professional_category" autoComplete="organization-title" value={field.value ?? undefined} />} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item label="Email" name="email" style={{ flex: 1 }}>
              <Controller name="email" control={control} render={({ field }) => <Input {...field} id="email" autoComplete="email" data-testid="user-email" />} />
            </Form.Item>
            <Form.Item label="Teléfono" name="phone" style={{ flex: 1 }}>
              <Controller name="phone" control={control} render={({ field }) => <Input {...field} id="phone" autoComplete="tel" value={field.value ?? undefined} data-testid="user-phone" />} />
            </Form.Item>
            <Form.Item label="Fecha de Nacimiento" name="birth_date" style={{ flex: 1 }} help={errors.birth_date?.message} validateStatus={errors.birth_date ? "error" : undefined}>
              <Controller 
                name="birth_date" 
                control={control} 
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="birth_date"
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(date) => field.onChange(date ? date.toDate() : null)}
                    format="DD/MM/YYYY"
                    placeholder="Seleccionar fecha"
                    style={{ width: '100%' }}
                  />
                )}
              />
            </Form.Item>
            <Form.Item label="Sexo" name="gender" style={{ flex: 1 }}>
              <Controller
                name="gender"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    id="gender"
                    value={field.value ?? undefined}
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
          {moodleUsers && moodleUsers.length > 0 && (
            <div style={{ display: 'flex', gap: '16px', marginTop: 8 }}>
              <Form.Item label="Username Moodle" name="moodle_username" style={{ flex: 1 }}>
                <Controller
                  name="moodle_username"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="moodle_username"
                      value={field.value ?? moodleUsername ?? ''}
                      onChange={(e) => {
                        field.onChange(e);
                        setMoodleUsername(e.target.value);
                      }}
                    />
                  )}
                />
              </Form.Item>
              <Form.Item label="Password Moodle" name="moodle_password" style={{ flex: 1 }}>
                <Controller
                  name="moodle_password"
                  control={control}
                  render={({ field }) => (
                    <Input.Password
                      {...field}
                      id="moodle_password"
                      value={field.value ?? moodlePassword ?? ''}
                      onChange={(e) => {
                        field.onChange(e);
                        setMoodlePassword(e.target.value);
                      }}
                    />
                  )}
                />
              </Form.Item>
              {/* Debug UI removed */}
            </div>
          )}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <Form.Item label="Dirección" name="address" style={{ flex: 3, minWidth: '40ch' }}>
              <Controller name="address" control={control} render={({ field }) => <Input {...field} id="address" autoComplete="street-address" value={field.value ?? undefined} />} />
            </Form.Item>
            <Form.Item label="Código Postal" name="postal_code" style={{ flex: 1, minWidth: '10ch' }}>
              <Controller name="postal_code" control={control} render={({ field }) => <Input {...field} id="postal_code" autoComplete="postal-code" value={field.value ?? undefined} />} />
            </Form.Item>
            <Form.Item label="Ciudad" name="city" style={{ flex: 1, minWidth: '10ch' }}>
              <Controller name="city" control={control} render={({ field }) => <Input {...field} id="city" autoComplete="address-level2" value={field.value ?? undefined} />} />
            </Form.Item>
            <Form.Item label="Provincia" name="province" style={{ flex: 1, minWidth: '10ch' }}>
              <Controller name="province" control={control} render={({ field }) => <Input {...field} id="province" autoComplete="address-level1" value={field.value ?? undefined} />} />
            </Form.Item>
            <Form.Item label="País" name="country" style={{ flex: 1, minWidth: '10ch' }}>
              <Controller name="country" control={control} render={({ field }) => <Input {...field} id="country" autoComplete="country-name" value={field.value ?? undefined} />} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item label="Grupo de Cotización" name="salary_group" style={{ flex: 1 }} extra={salaryGroupValue == null ? 'No especificado — se guardará vacío. Se mostrará un aviso al guardar.' : undefined}>
              <Controller
                name="salary_group"
                control={control}
                render={({ field }) => {
                  const options = SALARY_GROUP_OPTIONS;

                  return (
                    <Select
                      {...field}
                      id="salary_group"
                      value={field.value ?? undefined}
                      onChange={(val) => {
                        // val can be undefined when cleared
                        if (typeof val === 'undefined' || val === null) field.onChange(null);
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
            <Form.Item label="Nivel Educativo" name="education_level" style={{ flex: 1 }} extra={educationLevelValue == null ? 'No especificado — se guardará vacío. Se mostrará un aviso al guardar.' : undefined}>
              <Controller
                name="education_level"
                control={control}
                render={({ field }) => {
                  const options = EDUCATION_LEVEL_OPTIONS;

                  const currentValue = typeof field.value === 'number' ? field.value : (field.value ? Number(field.value) : undefined);

                  return (
                    <Select
                      {...field}
                      id="education_level"
                      value={currentValue}
                      onChange={(val) => {
                        if (typeof val === 'undefined' || val === null) field.onChange(null);
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
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Form.Item name="disability" valuePropName="checked" style={{ flex: 1, marginBottom: 0 }}>
              <Controller
                name="disability"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    {...field}
                    id="disability"
                    checked={!!field.value}
                  >
                    Discapacidad
                  </Checkbox>
                )}
              />
            </Form.Item>
            <Form.Item name="terrorism_victim" valuePropName="checked" style={{ flex: 1, marginBottom: 0 }}>
              <Controller
                name="terrorism_victim"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    {...field}
                    id="terrorism_victim"
                    checked={!!field.value}
                  >
                    Víctima de Terrorismo
                  </Checkbox>
                )}
              />
            </Form.Item>
            <Form.Item name="gender_violence_victim" valuePropName="checked" style={{ flex: 1, marginBottom: 0 }}>
              <Controller
                name="gender_violence_victim"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    {...field}
                    id="gender_violence_victim"
                    checked={!!field.value}
                  >
                    Víctima de Violencia de Género
                  </Checkbox>
                )}
              />
            </Form.Item>
            <Form.Item name="seasonalWorker" valuePropName="checked" style={{ flex: 1, marginBottom: 0 }}>
              <Controller
                name="seasonalWorker"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    {...field}
                    id="seasonalWorker"
                    checked={!!field.value}
                  >
                    Trabajador fijo-discontinuo
                  </Checkbox>
                )}
              />
            </Form.Item>
            <Form.Item name="erteLaw" valuePropName="checked" style={{ flex: 1, marginBottom: 0 }}>
              <Controller
                name="erteLaw"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    {...field}
                    id="erteLaw"
                    checked={!!field.value}
                  >
                    ERTE RD Ley
                  </Checkbox>
                )}
              />
            </Form.Item>
            <Form.Item name="accreditationDiploma" valuePropName="checked" style={{ flex: 1, marginBottom: 0 }}>
              <Controller
                name="accreditationDiploma"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="accreditationDiploma"
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
            <Controller name="observations" control={control} render={({ field }) => <Input.TextArea {...field} id="observations" autoComplete="off" value={field.value ?? undefined} rows={3} />} />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
            <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
            <AuthzHide roles={[Role.ADMIN]}>
            <Button type="primary" htmlType="submit" data-testid="save-user">Guardar</Button>
            <Button type="primary" danger onClick={handleDelete}>Eliminar Usuario</Button>
            </AuthzHide>
          </div>
        </Form>
      ),
    },
    {
      key: "2",
      label: "Empresa/Centros",
      children: (
        <AddUserToCenterSection id_user={userId} />
      ),
    },
  ];

  // Agregar pestaña de Moodle condicionalmente si hay usuarios de Moodle
  if (moodleUsers && moodleUsers.length > 0) {
    items.push({
      key: "3",
      label: "Moodle",
      children: (
        <MoodleUsersSection userId={userId} />
      ),
    });
  }

  // Agregar pestaña de Cursos condicionalmente si hay cursos matriculados
  if (userCourses && userCourses.length > 0) {
    items.push({
      key: "4",
      label: "Cursos",
      children: (
        <UserCoursesSection userId={userId} />
      ),
    });
  }

  return (
    <>
      {contextHolder}
      <Tabs defaultActiveKey={defaultActiveKey} items={items} />
    </>
  );
}