import { useParams, useNavigate, Link } from "react-router-dom";
import { App, Button, Form, Input, InputNumber, Select, Table, Tag } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RouteTabs } from "../../components/common/RouteTabs";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useConsultingClientQuery } from "../../hooks/api/consulting-client/use-consulting-client.query";
import { useUpdateConsultingClientMutation } from "../../hooks/api/consulting-client/use-update-consulting-client.mutation";
import { useConsultingClientCompaniesQuery } from "../../hooks/api/consulting-client/use-consulting-client-companies.query";
import { useAddConsultingClientCompanyMutation } from "../../hooks/api/consulting-client/use-add-consulting-client-company.mutation";
import { useRemoveConsultingClientCompanyMutation } from "../../hooks/api/consulting-client/use-remove-consulting-client-company.mutation";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersByCompaniesQuery } from "../../hooks/api/centers/use-centers-by-companies.query";
import { useConsultingAnnualEngagementsQuery } from "../../hooks/api/consulting-annual-engagement/use-consulting-annual-engagements.query";
import { useOpenConsultingAnnualEngagementMutation } from "../../hooks/api/consulting-annual-engagement/use-open-consulting-annual-engagement.mutation";
import { useUpdateConsultingAnnualEngagementMutation } from "../../hooks/api/consulting-annual-engagement/use-update-consulting-annual-engagement.mutation";

const CONSULTING_CLIENT_FORM = z.object({
  name: z.string({ required_error: "El nombre es obligatorio" }).min(1, "El nombre no puede estar vacío"),
});

export default function ConsultingClientDetailRoute() {
  const { id } = useParams();
  const id_consulting_client = id || "";
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const { data: clientData, isLoading: isClientLoading } = useConsultingClientQuery(id_consulting_client);
  const { mutateAsync: updateClient } = useUpdateConsultingClientMutation(id_consulting_client);
  const { data: clientCompaniesData, isLoading: isClientCompaniesLoading } = useConsultingClientCompaniesQuery(id_consulting_client);
  const { data: allCompaniesData } = useCompaniesQuery();
  const { mutateAsync: addCompany, isPending: isAdding } = useAddConsultingClientCompanyMutation(id_consulting_client);
  const { mutateAsync: removeCompany } = useRemoveConsultingClientCompanyMutation(id_consulting_client);

  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof CONSULTING_CLIENT_FORM>>({
    resolver: zodResolver(CONSULTING_CLIENT_FORM),
  });

  useEffect(() => {
    if (clientData) reset({ name: clientData.name });
  }, [clientData, reset]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>();

  const linkedCompanyIds = useMemo(
    () => new Set((clientCompaniesData ?? []).map((c) => c.id_company)),
    [clientCompaniesData]
  );

  const availableCompanies = (allCompaniesData ?? []).filter((c) => !linkedCompanyIds.has(c.id_company));

  const companyIds = useMemo(() => (clientCompaniesData ?? []).map((c) => c.id_company), [clientCompaniesData]);
  const { data: centersData } = useCentersByCompaniesQuery(companyIds);

  const currentYear = new Date().getFullYear();
  const { data: engagementsData, isLoading: isEngagementsLoading } = useConsultingAnnualEngagementsQuery(id_consulting_client);
  const { mutateAsync: openEngagement, isPending: isOpeningEngagement } = useOpenConsultingAnnualEngagementMutation(id_consulting_client);
  const { mutateAsync: updateEngagement } = useUpdateConsultingAnnualEngagementMutation(id_consulting_client);

  const [newEngagementYear, setNewEngagementYear] = useState<number | null>(currentYear);
  const [newEngagementCenterIds, setNewEngagementCenterIds] = useState<number[]>([]);

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

  const handleOpenEngagement = async () => {
    if (!newEngagementYear) return;
    try {
      await openEngagement({ year: newEngagementYear, id_centers: newEngagementCenterIds.length > 0 ? newEngagementCenterIds : undefined });
      setNewEngagementYear(currentYear + 1);
      setNewEngagementCenterIds([]);
    } catch {
      message.error('No se pudo abrir la consultoría. Puede que ya exista una para ese año.');
    }
  };

  const handleToggleEngagement = async (id_annual_engagement: number, status: 'OPEN' | 'CLOSED') => {
    try {
      await updateEngagement({ id_annual_engagement, status });
    } catch {
      message.error('No se pudo actualizar la consultoría. Inténtalo de nuevo.');
    }
  };

  const submitName: SubmitHandler<z.infer<typeof CONSULTING_CLIENT_FORM>> = async (info) => {
    try {
      await updateClient(info);
      navigate('/consultoria');
    } catch {
      message.error('No se pudo guardar el nombre. Inténtalo de nuevo.');
    }
  };

  const items = [
    {
      key: "datos",
      label: "Cliente",
      children: (
        <Form layout="vertical" onFinish={handleSubmit(submitName)} style={{ maxWidth: 420 }}>
          <Form.Item
            label="Nombre del cliente"
            name="name"
            required
            help={errors.name?.message}
            validateStatus={errors.name ? "error" : undefined}
          >
            <Controller name="name" control={control} render={({ field }) => <Input id="name" data-testid="name" {...field} />} />
          </Form.Item>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="submit">
              Guardar
            </Button>
          </AuthzHide>
        </Form>
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
    {
      key: "consultoria",
      label: "Consultoría",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Una consultoría por año. Al abrirla se incluyen todos los centros del cliente, salvo que elijas unos concretos, y se clona el plan de la consultoría anterior como punto de partida. Desde ella se gestiona el plan, se evalúan las acciones y se lleva el cuadro de formación, centro a centro.
          </p>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <InputNumber value={newEngagementYear} onChange={setNewEngagementYear} min={2000} placeholder="Año" style={{ width: 100 }} />
              <Select
                mode="multiple"
                placeholder="Centros (vacío = todos)"
                style={{ minWidth: 320 }}
                value={newEngagementCenterIds}
                onChange={setNewEngagementCenterIds}
                options={(centersData ?? []).map((c) => ({ value: c.id_center, label: c.center_name }))}
              />
              <Button type="primary" onClick={handleOpenEngagement} disabled={!newEngagementYear} loading={isOpeningEngagement}>
                Abrir consultoría
              </Button>
            </div>
          </AuthzHide>
          <Table
            rowKey="id_annual_engagement"
            loading={isEngagementsLoading}
            dataSource={engagementsData}
            pagination={false}
            columns={[
              { title: 'Año', dataIndex: 'year' },
              { title: 'Estado', dataIndex: 'status', render: (status: 'OPEN' | 'CLOSED') => status === 'OPEN' ? <Tag color="green">Abierta</Tag> : <Tag color="default">Cerrada</Tag> },
              { title: 'Abierta el', dataIndex: 'opened_at', render: (v: string) => new Date(v).toLocaleDateString() },
              { title: 'Cerrada el', dataIndex: 'closed_at', render: (v: string | null) => v ? new Date(v).toLocaleDateString() : '—' },
              {
                title: '',
                key: 'actions',
                width: 220,
                render: (_, record) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/consultoria/clients/${id_consulting_client}/annual-engagements/${record.id_annual_engagement}`}>Entrar</Link>
                    <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                      {record.status === 'OPEN'
                        ? <Button size="small" onClick={() => handleToggleEngagement(record.id_annual_engagement, 'CLOSED')}>Cerrar</Button>
                        : <Button size="small" onClick={() => handleToggleEngagement(record.id_annual_engagement, 'OPEN')}>Reabrir</Button>}
                    </AuthzHide>
                  </div>
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
