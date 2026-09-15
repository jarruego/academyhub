import { useParams } from "react-router-dom";
import { App, Button, Descriptions, Select, Table } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { RouteTabs } from "../../components/common/RouteTabs";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useConsultingClientQuery } from "../../hooks/api/consulting-client/use-consulting-client.query";
import { useConsultingClientCompaniesQuery } from "../../hooks/api/consulting-client/use-consulting-client-companies.query";
import { useAddConsultingClientCompanyMutation } from "../../hooks/api/consulting-client/use-add-consulting-client-company.mutation";
import { useRemoveConsultingClientCompanyMutation } from "../../hooks/api/consulting-client/use-remove-consulting-client-company.mutation";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";

export default function ConsultingClientDetailRoute() {
  const { id } = useParams();
  const id_consulting_client = id || "";
  const { message, modal } = App.useApp();

  const { data: clientData, isLoading: isClientLoading } = useConsultingClientQuery(id_consulting_client);
  const { data: clientCompaniesData, isLoading: isClientCompaniesLoading } = useConsultingClientCompaniesQuery(id_consulting_client);
  const { data: allCompaniesData } = useCompaniesQuery();
  const { mutateAsync: addCompany, isPending: isAdding } = useAddConsultingClientCompanyMutation(id_consulting_client);
  const { mutateAsync: removeCompany } = useRemoveConsultingClientCompanyMutation(id_consulting_client);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>();

  const linkedCompanyIds = useMemo(
    () => new Set((clientCompaniesData ?? []).map((c) => c.id_company)),
    [clientCompaniesData]
  );

  const availableCompanies = (allCompaniesData ?? []).filter((c) => !linkedCompanyIds.has(c.id_company));

  if (isClientLoading) return <div>Cargando...</div>;
  if (!clientData) return <div>Cliente no encontrado</div>;

  const handleAdd = async () => {
    if (!selectedCompanyId) return;
    try {
      await addCompany(selectedCompanyId);
      setSelectedCompanyId(undefined);
    } catch {
      message.error('No se pudo vincular la empresa. Inténtalo de nuevo.');
    }
  };

  const handleRemove = (id_company: number, company_name: string) => {
    modal.confirm({
      title: `¿Quitar "${company_name}" de este cliente?`,
      content: "No se elimina la empresa de la aplicación, solo deja de pertenecer a este cliente de consultoría.",
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeCompany(id_company);
        } catch {
          message.error('No se pudo quitar la empresa. Inténtalo de nuevo.');
        }
      },
    });
  };

  const items = [
    {
      key: "datos",
      label: "Cliente",
      children: (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Nombre">{clientData.name}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: "empresas",
      label: "Empresas",
      children: (
        <div>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Select
                showSearch
                placeholder="Buscar empresa por nombre..."
                style={{ minWidth: 360 }}
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={availableCompanies.map((c) => ({ value: c.id_company, label: c.company_name }))}
              />
              <Button type="primary" onClick={handleAdd} disabled={!selectedCompanyId} loading={isAdding}>
                Vincular empresa
              </Button>
            </div>
          </AuthzHide>
          <Table
            rowKey="id_consulting_client_company"
            loading={isClientCompaniesLoading}
            dataSource={clientCompaniesData}
            pagination={false}
            columns={[
              { title: 'Nombre', dataIndex: 'company_name' },
              { title: 'Razón Social', dataIndex: 'corporate_name' },
              { title: 'CIF', dataIndex: 'cif' },
              {
                title: '',
                key: 'actions',
                width: 80,
                render: (_, record) => (
                  <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemove(record.id_company, record.company_name)}
                      aria-label={`Quitar ${record.company_name}`}
                    />
                  </AuthzHide>
                ),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return <RouteTabs items={items} />;
}
