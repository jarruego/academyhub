import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { App, Button, Form, Input, Modal } from "antd";
import { useCenterQuery } from "../../hooks/api/centers/use-center.query";
import { useUpdateCenterMutation } from "../../hooks/api/centers/use-update-center.mutation";
import { useDeleteCenterMutation } from "../../hooks/api/centers/use-delete-center.mutation";
import { useCompanyQuery } from "../../hooks/api/companies/use-company.query";
import { useEffect } from "react";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const CENTER_FORM_SCHEMA = z.object({
  id_center: z.number(),
  employer_number: z.string().optional().nullish(),
  center_name: z.string({ required_error: "El nombre del centro es obligatorio" }).min(2, "El nombre es demasiado corto"),
  id_company: z.number(),
  contact_person: z.string().optional().nullish(),
  contact_phone: z.string().optional().nullish(),
  contact_email: z.string().email("El email no es válido").optional().nullish(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export default function EditCenterRoute() {
  // Envolvemos el uso de message con un valor por defecto seguro para evitar errores en test
  const { message = { success: () => {}, error: () => {} } } = App.useApp?.() ?? {};
  const { id_center } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: centerData, isLoading: isCenterLoading } = useCenterQuery(id_center || "");
  const { data: companyData, isLoading: isCompanyLoading } = useCompanyQuery(centerData?.id_company ? String(centerData.id_company) : "");
  const { mutateAsync: updateCenter } = useUpdateCenterMutation(id_center || "");
  const { mutateAsync: deleteCenter } = useDeleteCenterMutation(id_center || "");
  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof CENTER_FORM_SCHEMA>>({
    resolver: zodResolver(CENTER_FORM_SCHEMA),
  });
  const [modal, contextHolder] = Modal.useModal();

  useEffect(() => {
    document.title = `Detalle del Centro ${id_center}`;
  }, [id_center]);

  useEffect(() => {
    if (centerData) {
      reset(centerData);
    }
  }, [centerData, reset]);

  if (isCenterLoading || (centerData && isCompanyLoading)) return <div>Cargando...</div>;

  const submit: SubmitHandler<z.infer<typeof CENTER_FORM_SCHEMA>> = async (data) => {
    try {
      await updateCenter(data);
      message.success('Centro actualizado exitosamente');
      navigate(location.state?.from || `/companies/${centerData?.id_company}?tab=centers`);
    } catch {
      message.error('No se pudo actualizar el centro');
    }
  };

  const handleDelete = async () => {
    modal.confirm({
      title: "¿Seguro que desea eliminar este centro?",
      content: "Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteCenter();
          message.success('Centro eliminado exitosamente');
          navigate(location.state?.from || `/companies/${centerData?.id_company}?tab=centers`);
        } catch {
          modal.error({
            title: "Error al eliminar el centro",
            content: "No se pudo eliminar el centro. Inténtelo de nuevo.",
          });
        }
      },
    });
  };

  return (
    <div>
      {contextHolder}
      {companyData && (
        <Form.Item label="Empresa:" style={{ marginBottom: 0, display: 'flex', gap: 8 }}>
          <Input value={companyData.corporate_name} disabled style={{ width: 400, flex: 1 }} />
          <Button
            type="link"
            onClick={() => navigate(`/companies/${companyData.id_company}`)}
            style={{ width: 'auto', flex: 1 }}
          >
            Ver
          </Button>
        </Form.Item>
      )}
      <Form layout="vertical" onFinish={handleSubmit(submit)} style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="ID centro" name="id_center"
            help={errors.id_center?.message}
            validateStatus={errors.id_center ? "error" : undefined}
          >
            <Controller name="id_center" control={control} render={({ field }) => <Input {...field} disabled data-testid="center-id" />} />
          </Form.Item>
          <Form.Item label="Nombre del centro" name="center_name"
            help={errors.center_name?.message}
            validateStatus={errors.center_name ? "error" : undefined}
          >
            <Controller name="center_name" control={control} render={({ field }) => <Input {...field} data-testid="center-name" />} />
          </Form.Item>
          <Form.Item label="Número de patronal" name="employer_number"
            help={errors.employer_number?.message}
            validateStatus={errors.employer_number ? "error" : undefined}
          >
            <Controller name="employer_number" control={control} render={({ field }) => <Input {...field} value={field.value ?? undefined} data-testid="employer-number" />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item label="Persona de contacto" name="contact_person"
            help={errors.contact_person?.message}
            validateStatus={errors.contact_person ? "error" : undefined}
          >
            <Controller name="contact_person" control={control} render={({ field }) => <Input {...field} value={field.value ?? undefined} data-testid="contact-person" />} />
          </Form.Item>
          <Form.Item label="Teléfono de contacto" name="contact_phone"
            help={errors.contact_phone?.message}
            validateStatus={errors.contact_phone ? "error" : undefined}
          >
            <Controller name="contact_phone" control={control} render={({ field }) => <Input {...field} value={field.value ?? undefined} data-testid="contact-phone" />} />
          </Form.Item>
          <Form.Item label="Email de contacto" name="contact_email"
            help={errors.contact_email?.message}
            validateStatus={errors.contact_email ? "error" : undefined}
          >
            <Controller name="contact_email" control={control} render={({ field }) => <Input {...field} value={field.value ?? undefined} data-testid="contact-email" />} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
          <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="save-center">Guardar</Button>
          <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />}>Eliminar Centro</Button>
          </AuthzHide>
        </div>
      </Form>
    </div>
  );
}
