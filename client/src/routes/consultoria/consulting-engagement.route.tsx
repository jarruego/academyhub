import { useParams, Link } from "react-router-dom";
import { App, Button, Select, Table, Tag } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useConsultingClientQuery } from "../../hooks/api/consulting-client/use-consulting-client.query";
import { useConsultingClientCompaniesQuery } from "../../hooks/api/consulting-client/use-consulting-client-companies.query";
import { useCentersByCompaniesQuery } from "../../hooks/api/centers/use-centers-by-companies.query";
import { useConsultingAnnualEngagementsQuery } from "../../hooks/api/consulting-annual-engagement/use-consulting-annual-engagements.query";
import { useConsultingEngagementCentersQuery } from "../../hooks/api/consulting-annual-engagement/use-consulting-engagement-centers.query";
import { useAddConsultingEngagementCenterMutation } from "../../hooks/api/consulting-annual-engagement/use-add-consulting-engagement-center.mutation";
import { useRemoveConsultingEngagementCenterMutation } from "../../hooks/api/consulting-annual-engagement/use-remove-consulting-engagement-center.mutation";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

// Una consultoría anual concreta (cliente + año) y los centros que
// participan en ella — cada uno se trabaja por separado (evaluación de
// acciones, cuadro). Ver docs/consultoria.md.
export default function ConsultingEngagementRoute() {
  const { id, id_annual_engagement } = useParams();
  const id_consulting_client = id || "";
  const { message, modal } = App.useApp();

  const { data: clientData } = useConsultingClientQuery(id_consulting_client);
  const { data: engagementsData } = useConsultingAnnualEngagementsQuery(id_consulting_client);
  const engagement = engagementsData?.find((e) => e.id_annual_engagement === Number(id_annual_engagement));

  const { data: clientCompaniesData } = useConsultingClientCompaniesQuery(id_consulting_client);
  const companyIds = useMemo(() => (clientCompaniesData ?? []).map((c) => c.id_company), [clientCompaniesData]);
  const { data: allCentersData } = useCentersByCompaniesQuery(companyIds);

  const { data: participatingCenters, isLoading } = useConsultingEngagementCentersQuery(id_consulting_client, id_annual_engagement || "");
  const { mutateAsync: addCenter, isPending: isAdding } = useAddConsultingEngagementCenterMutation(id_consulting_client, id_annual_engagement || "");
  const { mutateAsync: removeCenter } = useRemoveConsultingEngagementCenterMutation(id_consulting_client, id_annual_engagement || "");

  const [selectedCenterId, setSelectedCenterId] = useState<number | undefined>();

  const participatingIds = useMemo(() => new Set((participatingCenters ?? []).map((c) => c.id_center)), [participatingCenters]);
  const availableCenters = (allCentersData ?? []).filter((c) => !participatingIds.has(c.id_center));

  const handleAdd = async () => {
    if (!selectedCenterId) return;
    try {
      await addCenter(selectedCenterId);
      setSelectedCenterId(undefined);
    } catch {
      message.error('No se pudo añadir el centro. Inténtalo de nuevo.');
    }
  };

  const handleRemove = (id_center: number, center_name: string) => {
    modal.confirm({
      title: `¿Quitar "${center_name}" de esta consultoría?`,
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removeCenter(id_center);
        } catch {
          message.error('No se pudo quitar el centro. Inténtalo de nuevo.');
        }
      },
    });
  };

  return (
    <div>
      <p>
        <Link to={`/consultoria/clients/${id_consulting_client}`}>← {clientData?.name ?? 'Cliente'}</Link>
      </p>
      <h2 style={{ marginTop: 0 }}>
        Consultoría {engagement?.year ?? ''}
        {engagement && (engagement.status === 'OPEN' ? <Tag color="green" style={{ marginLeft: 12 }}>Abierta</Tag> : <Tag style={{ marginLeft: 12 }}>Cerrada</Tag>)}
      </h2>
      <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -8, marginBottom: 16 }}>
        Centros que participan en esta consultoría. Entra en uno para evaluar sus acciones y ver su cuadro de formación.
      </p>
      <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            showSearch
            placeholder="Añadir un centro..."
            style={{ minWidth: 320 }}
            value={selectedCenterId}
            onChange={setSelectedCenterId}
            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={availableCenters.map((c) => ({ value: c.id_center, label: c.center_name }))}
          />
          <Button type="primary" onClick={handleAdd} disabled={!selectedCenterId} loading={isAdding}>
            Añadir centro
          </Button>
        </div>
      </AuthzHide>
      <Table
        rowKey="id_center"
        loading={isLoading}
        dataSource={participatingCenters}
        pagination={false}
        columns={[
          { title: 'Centro', dataIndex: 'center_name' },
          {
            title: '',
            key: 'actions',
            width: 220,
            render: (_, record) => (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/consultoria/clients/${id_consulting_client}/annual-engagements/${id_annual_engagement}/centers/${record.id_center}`}>Entrar</Link>
                <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
                  <Button
                    danger
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemove(record.id_center, record.center_name)}
                    aria-label={`Quitar ${record.center_name}`}
                  />
                </AuthzHide>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
