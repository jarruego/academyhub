import { useParams, Link } from "react-router-dom";
import { App, Button, Modal, Select, Table, Tag } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { RouteTabs } from "../../components/common/RouteTabs";
import { useConsultingClientQuery } from "../../hooks/api/consulting-client/use-consulting-client.query";
import { useConsultingClientCompaniesQuery } from "../../hooks/api/consulting-client/use-consulting-client-companies.query";
import { useCentersByCompaniesQuery } from "../../hooks/api/centers/use-centers-by-companies.query";
import { useConsultingAnnualEngagementsQuery } from "../../hooks/api/consulting-annual-engagement/use-consulting-annual-engagements.query";
import { useConsultingEngagementCentersQuery } from "../../hooks/api/consulting-annual-engagement/use-consulting-engagement-centers.query";
import { useAddConsultingEngagementCenterMutation } from "../../hooks/api/consulting-annual-engagement/use-add-consulting-engagement-center.mutation";
import { useRemoveConsultingEngagementCenterMutation } from "../../hooks/api/consulting-annual-engagement/use-remove-consulting-engagement-center.mutation";
import { useConsultingActionsQuery } from "../../hooks/api/consulting-action/use-consulting-actions.query";
import { useConsultingPlanItemsQuery } from "../../hooks/api/consulting-plan-item/use-consulting-plan-items.query";
import { useAddConsultingPlanItemMutation } from "../../hooks/api/consulting-plan-item/use-add-consulting-plan-item.mutation";
import { useAddConsultingPlanItemToAllCentersMutation } from "../../hooks/api/consulting-plan-item/use-add-consulting-plan-item-to-all-centers.mutation";
import { useRemoveConsultingPlanItemMutation } from "../../hooks/api/consulting-plan-item/use-remove-consulting-plan-item.mutation";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

// Una consultoría anual concreta (cliente + año): centros que participan
// (se trabajan por separado — evaluación de acciones, cuadro) y el plan
// base de esta consultoría, propio de este ejercicio. Ver docs/consultoria.md.
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

  const handleAddCenter = async () => {
    if (!selectedCenterId) return;
    try {
      await addCenter(selectedCenterId);
      setSelectedCenterId(undefined);
    } catch {
      message.error('No se pudo añadir el centro. Inténtalo de nuevo.');
    }
  };

  const handleRemoveCenter = (id_center: number, center_name: string) => {
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

  // --- Plan base de esta consultoría ---
  const { data: actionsData } = useConsultingActionsQuery();
  const { data: planItemsData, isLoading: isPlanItemsLoading } = useConsultingPlanItemsQuery(id_consulting_client, id_annual_engagement || "");
  const { mutateAsync: addPlanItem, isPending: isAddingPlanItem } = useAddConsultingPlanItemMutation(id_consulting_client, id_annual_engagement || "");
  const { mutateAsync: addPlanItemToAllCenters, isPending: isAddingToAllCenters } = useAddConsultingPlanItemToAllCentersMutation(id_consulting_client, id_annual_engagement || "");
  const { mutateAsync: removePlanItem, isPending: isRemovingPlanItem } = useRemoveConsultingPlanItemMutation(id_consulting_client, id_annual_engagement || "");

  const [planCatalogCourseId, setPlanCatalogCourseId] = useState<number | undefined>();
  const [removePlanItemTarget, setRemovePlanItemTarget] = useState<{ id_plan_item: number; name: string } | null>(null);

  const basePlanItems = useMemo(() => (planItemsData ?? []).filter((item) => item.id_center === null), [planItemsData]);
  const availableBaseActions = useMemo(() => {
    const covered = new Set(basePlanItems.map((item) => item.id_catalog_course));
    return (actionsData ?? []).filter((a) => !covered.has(a.id_catalog_course));
  }, [actionsData, basePlanItems]);

  const handleAddToBase = () => {
    if (!planCatalogCourseId) return;
    const actionName = actionsData?.find((a) => a.id_catalog_course === planCatalogCourseId)?.name ?? 'esta acción';
    modal.confirm({
      title: `¿Añadir "${actionName}" al plan base?`,
      content: "Queda compartida: se añade automáticamente al plan de todos los centros que participan en esta consultoría, también a los que se añadan después.",
      okText: "Añadir al base",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await addPlanItem({ id_center: null, id_catalog_course: planCatalogCourseId });
          setPlanCatalogCourseId(undefined);
        } catch (error) {
          message.error(errorMessage(error, 'No se pudo añadir la acción al plan base. Puede que ya esté añadida.'));
        }
      },
    });
  };

  const handleAddToAllCentersIndividually = () => {
    if (!planCatalogCourseId) return;
    const actionName = actionsData?.find((a) => a.id_catalog_course === planCatalogCourseId)?.name ?? 'esta acción';
    modal.confirm({
      title: `¿Añadir "${actionName}" a cada centro por separado?`,
      content: "No queda en el plan base: se crea una copia propia para cada centro que participa en esta consultoría ahora mismo. Un centro que se añada después no la recibe — habría que añadírsela a mano.",
      okText: "Añadir a cada centro",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await addPlanItemToAllCenters(planCatalogCourseId);
          setPlanCatalogCourseId(undefined);
        } catch (error) {
          message.error(errorMessage(error, 'No se pudo añadir la acción a los centros.'));
        }
      },
    });
  };

  const handleRemoveFromAllCenters = async () => {
    if (!removePlanItemTarget) return;
    try {
      await removePlanItem({ id_plan_item: removePlanItemTarget.id_plan_item });
      setRemovePlanItemTarget(null);
    } catch (error) {
      setRemovePlanItemTarget(null);
      modal.error({
        title: "No se pudo quitar la acción",
        content: errorMessage(error, 'No se pudo quitar la acción del plan. Inténtalo de nuevo.'),
        okText: "Entendido",
      });
    }
  };

  const handleRemoveFromBaseKeepInCenters = async () => {
    if (!removePlanItemTarget) return;
    try {
      await removePlanItem({ id_plan_item: removePlanItemTarget.id_plan_item, keepForCenters: true });
      setRemovePlanItemTarget(null);
    } catch (error) {
      message.error(errorMessage(error, 'No se pudo quitar la acción del plan base.'));
    }
  };

  const items = [
    {
      key: "centros",
      label: "Centros",
      children: (
        <div>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
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
              <Button type="primary" onClick={handleAddCenter} disabled={!selectedCenterId} loading={isAdding}>
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
                        onClick={() => handleRemoveCenter(record.id_center, record.center_name)}
                        aria-label={`Quitar ${record.center_name}`}
                      />
                    </AuthzHide>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      children: (
        <div>
          <h3 style={{ marginTop: 0 }}>Plan base</h3>
          <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
            Compartido por los centros que participan en esta consultoría. Solo se pueden añadir acciones ya etiquetadas en <Link to="/consultoria/actions">Acciones formativas</Link>. Al abrir una consultoría nueva, este plan se clona del año anterior como punto de partida.
          </p>
          <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Select
                showSearch
                placeholder="Buscar acción formativa por nombre..."
                style={{ minWidth: 360 }}
                value={planCatalogCourseId}
                onChange={setPlanCatalogCourseId}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={availableBaseActions.map((a) => ({ value: a.id_catalog_course, label: a.name }))}
              />
              <Button type="primary" onClick={handleAddToBase} disabled={!planCatalogCourseId} loading={isAddingPlanItem}>
                Añadir al plan base
              </Button>
              <Button onClick={handleAddToAllCentersIndividually} disabled={!planCatalogCourseId} loading={isAddingToAllCenters}>
                Añadir a cada centro (copia individual)
              </Button>
            </div>
          </AuthzHide>
          <Table
            rowKey="id_plan_item"
            loading={isPlanItemsLoading}
            dataSource={basePlanItems}
            pagination={false}
            columns={[
              { title: 'Acción', dataIndex: 'name' },
              { title: 'Origen', dataIndex: 'origin', render: (origin) => origin === 'EXTERNAL' ? 'Externo' : 'Propio' },
              { title: 'Categoría', dataIndex: 'category_name' },
              { title: 'Fecha', dataIndex: 'planning_date_name' },
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
                      onClick={() => setRemovePlanItemTarget({ id_plan_item: record.id_plan_item, name: record.name })}
                      aria-label={`Quitar ${record.name}`}
                    />
                  </AuthzHide>
                ),
              },
            ]}
          />
          <Modal
            open={!!removePlanItemTarget}
            title={`¿Quitar "${removePlanItemTarget?.name}" del plan base?`}
            onCancel={() => setRemovePlanItemTarget(null)}
            footer={[
              <Button key="cancel" onClick={() => setRemovePlanItemTarget(null)}>Cancelar</Button>,
              <Button key="keep" loading={isRemovingPlanItem} onClick={handleRemoveFromBaseKeepInCenters}>
                Quitar del base, mantener en cada centro
              </Button>,
              <Button key="all" danger type="primary" loading={isRemovingPlanItem} onClick={handleRemoveFromAllCenters}>
                Quitar de todos los centros
              </Button>,
            ]}
          >
            <p>
              <strong>Quitar del base, mantener en cada centro:</strong> deja de ser compartida — cada centro que la tenía por el plan base pasa a tener su propia copia, sin perder nada.
            </p>
            <p>
              <strong>Quitar de todos los centros:</strong> desaparece del todo. Se bloquea si algún centro ya la evaluó.
            </p>
          </Modal>
        </div>
      ),
    },
  ];

  return (
    <div>
      <p>
        <Link to={`/consultoria/clients/${id_consulting_client}`}>← {clientData?.name ?? 'Cliente'}</Link>
      </p>
      <h2 style={{ marginTop: 0 }}>
        Consultoría {engagement?.year ?? ''}
        {engagement && (engagement.status === 'OPEN' ? <Tag color="green" style={{ marginLeft: 12 }}>Abierta</Tag> : <Tag style={{ marginLeft: 12 }}>Cerrada</Tag>)}
      </h2>
      <RouteTabs items={items} />
    </div>
  );
}
