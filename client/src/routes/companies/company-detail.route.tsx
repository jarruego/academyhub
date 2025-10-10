import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCompanyQuery } from "../../hooks/api/companies/use-company.query";
import { useUpdateCompanyMutation } from "../../hooks/api/companies/use-update-company.mutation";
import { useDeleteCompanyMutation } from "../../hooks/api/companies/use-delete-company.mutation";
import { Button, Form, Input, Table, Tabs, Modal } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useEffect } from "react";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CIF_SCHEMA } from "../../schemas/cif.schema";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const COMPANY_FORM_SCHEMA = z.object({
  id_company: z.number(),
  company_name: z.string({ required_error: "El nombre es obligatorio" }).min(2, "El nombre no puede ser tan corto"),
  corporate_name: z.string({ required_error: "La razón social es obligatoria" }).min(2, "La razón social no puede ser tan corta"),
  cif: CIF_SCHEMA,
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export default function CompanyDetailRoute() {
  const navigate = useNavigate();
  const { id_company } = useParams();
  const { data: companyData, isLoading: isCompanyLoading } = useCompanyQuery(id_company || "");
  const { mutateAsync: updateCompany } = useUpdateCompanyMutation(id_company || "");
  const { mutateAsync: deleteCompany } = useDeleteCompanyMutation(id_company || "");
  const { data: centersData, isLoading: isCentersLoading } = useCentersQuery(id_company || "");
  const location = useLocation();

  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof COMPANY_FORM_SCHEMA>>({
    resolver: zodResolver(COMPANY_FORM_SCHEMA)
  });

  useEffect(() => {
    if (companyData) {
      reset(companyData);
    }
  }, [companyData, reset]);

  useEffect(() => {
    document.title = `Detalle de la Empresa ${id_company}`;
  }, [id_company]);

  const [modal, contextHolder] = Modal.useModal();

  if (!companyData) return <div>Empresa no encontrada</div>;
  if (isCompanyLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<z.infer<typeof COMPANY_FORM_SCHEMA>> = async (info) => {
    await updateCompany(info);
    navigate('/companies');
  }

  const handleDelete = async () => {
    modal.confirm({
      title: "¿Seguro que desea eliminar esta empresa?",
      content: "Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteCompany();
          navigate('/companies');
        } catch {
          modal.error({
            title: "Error al eliminar la empresa",
            content: "No se pudo eliminar la empresa. Inténtalo de nuevo.",
          });
        }
      },
    });
  };

  const handleAddCenter = () => {
    navigate(`/companies/${id_company}/add-center`);
  };

  // Lee el parámetro 'tab' de la URL
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");
  const defaultActiveKey = tabParam === "centers" ? "2" : "1";

  const items = [
    {
      key: "1",
      label: "Datos de Empresa",
      children: (
        <Form layout="vertical" onFinish={handleSubmit(submit)}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
            <Form.Item label="ID" name="id_company" style={{ maxWidth: '35px' }}>
              <Controller name="id_company" control={control} render={({ field }) => <Input id="id_company" data-testid="id_company" {...field} disabled />} />
            </Form.Item>
            <Form.Item
              label="CIF"
              name="cif"
              help={errors.cif?.message}
              validateStatus={errors.cif ? "error" : undefined}
            >
              <Controller name="cif" control={control} render={({ field }) => <Input id="cif" data-testid="cif" {...field} />} />
            </Form.Item>
          </div>
          <Form.Item
            label="Nombre de la empresa"
            name="company_name"
            help={errors.company_name?.message}
            validateStatus={errors.company_name ? "error" : undefined}
          >
            <Controller name="company_name" control={control} render={({ field }) => <Input id="company_name" autoComplete="organization" data-testid="company_name" {...field} />} />
          </Form.Item>
          <Form.Item
            label="Razón Social"
            name="corporate_name"
            help={errors.corporate_name?.message}
            validateStatus={errors.corporate_name ? "error" : undefined}
          >
            <Controller name="corporate_name" control={control} render={({ field }) => <Input id="corporate_name" autoComplete="organization" data-testid="corporate_name" {...field} />} />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
            <AuthzHide roles={[Role.ADMIN]}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="submit">Guardar</Button>
            <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />} data-testid="delete-company">Eliminar Empresa</Button>
            </AuthzHide>
          </div>
        </Form>
      ),
    },
    {
      key: "2",
      label: "Centros",
      children: (
        <>
          <Table
            rowKey="id_center"
            columns={[
              { title: 'ID', dataIndex: 'id_center' },
              { title: 'Nombre del centro', dataIndex: 'center_name' },
              { title: 'Número de patronal', dataIndex: 'employer_number' },
              { title: 'Persona de contacto', dataIndex: 'contact_person' },
              { title: 'Teléfono de contacto', dataIndex: 'contact_phone' },
              { title: 'Email de contacto', dataIndex: 'contact_email' },
            ]}
            dataSource={centersData}
            loading={isCentersLoading}
            onRow={(record) => ({
              onDoubleClick: () => navigate(`/centers/${record.id_center}/edit`),
              style: { cursor: 'pointer' }
            })}
          />
          <AuthzHide roles={[Role.ADMIN]}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCenter}>
            Añadir Centro
          </Button>
          </AuthzHide>
        </>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Tabs defaultActiveKey={defaultActiveKey} items={items} />
    </>
  );
}
