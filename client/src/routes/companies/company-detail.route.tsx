import { useParams, useNavigate } from "react-router-dom";
import { useCompanyQuery } from "../../hooks/api/companies/use-company.query";
import { useUpdateCompanyMutation } from "../../hooks/api/companies/use-update-company.mutation";
import { useDeleteCompanyMutation } from "../../hooks/api/companies/use-delete-company.mutation";
import { Button, Form, Input, message, Table, Tabs } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useEffect } from "react";
import { Company } from "../../shared/types/company/company";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";

export default function CompanyDetailRoute() {
  const navigate = useNavigate();
  const { id_company } = useParams();
  const { data: companyData, isLoading: isCompanyLoading } = useCompanyQuery(id_company || "");
  const { mutateAsync: updateCompany } = useUpdateCompanyMutation(id_company || "");
  const { mutateAsync: deleteCompany } = useDeleteCompanyMutation(id_company || "");
  const { data: centersData, isLoading: isCentersLoading } = useCentersQuery(id_company || "");

  const { handleSubmit, control, reset } = useForm<Company>();

  useEffect(() => {
    if (companyData) {
      reset(companyData);
    }
  }, [companyData, reset]);

  useEffect(() => {
    document.title = `Detalle de la Empresa ${id_company}`;
  }, [id_company]);

  if (!companyData) return <div>Empresa no encontrada</div>;
  if (isCompanyLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<Company> = async (info) => {
    await updateCompany(info);
    navigate('/companies');
  }

  const handleDelete = async () => {
    try {
      await deleteCompany();
      navigate('/companies');
    } catch {
      message.error('No se pudo eliminar la empresa. Inténtalo de nuevo.');
    }
  };

  const handleAddCenter = () => {
    navigate(`/companies/${id_company}/add-center`);
  };

  return (
    <Tabs defaultActiveKey="1">
      <Tabs.TabPane tab="Datos de Empresa" key="1">
        <Form layout="vertical" onFinish={handleSubmit(submit)}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
            <Form.Item label="ID" name="id_company" style={{ maxWidth: '35px' }}>
              <Controller name="id_company" control={control} render={({ field }) => <Input {...field} disabled />} />
            </Form.Item>
            <Form.Item label="CIF" name="cif">
              <Controller name="cif" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
          </div>
            <Form.Item label="Nombre de la empresa" name="company_name">
              <Controller name="company_name" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
          <Form.Item label="Razón Social" name="corporate_name">
            <Controller name="corporate_name" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
            <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />}>Eliminar Empresa</Button>
          </div>
        </Form>
      </Tabs.TabPane>
      <Tabs.TabPane tab="Centros" key="2">
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCenter}>
          Añadir Centro
        </Button>
      </Tabs.TabPane>
    </Tabs>
  );
}
