import { useParams, Link } from "react-router-dom";
import { App, Button, Select, Table } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useConsultingClientQuery } from "../../hooks/api/consulting-client/use-consulting-client.query";
import { useCenterQuery } from "../../hooks/api/centers/use-center.query";
import { useConsultingActionsQuery } from "../../hooks/api/consulting-action/use-consulting-actions.query";
import { useConsultingPlanItemsQuery } from "../../hooks/api/consulting-plan-item/use-consulting-plan-items.query";
import { useAddConsultingPlanItemMutation } from "../../hooks/api/consulting-plan-item/use-add-consulting-plan-item.mutation";
import { useRemoveConsultingPlanItemMutation } from "../../hooks/api/consulting-plan-item/use-remove-consulting-plan-item.mutation";

// Plan de un centro concreto: base heredado (solo lectura, se edita desde la
// ficha del cliente) + acciones propias por encima. Continuo, sin año — la
// consultoría anual (evaluación de acciones, cuadro) vive aparte, a nivel de
// cliente, ver consulting-engagement.route.tsx. Ver docs/consultoria.md.
export default function ConsultingCenterPlanRoute() {
  const { id, id_center } = useParams();
  const id_consulting_client = id || "";
  const { message, modal } = App.useApp();

  const { data: clientData } = useConsultingClientQuery(id_consulting_client);
  const { data: centerData } = useCenterQuery(id_center || "");
  const { data: actionsData } = useConsultingActionsQuery();
  const { data: planItemsData, isLoading } = useConsultingPlanItemsQuery(id_consulting_client);
  const { mutateAsync: addPlanItem, isPending: isAdding } = useAddConsultingPlanItemMutation(id_consulting_client);
  const { mutateAsync: removePlanItem } = useRemoveConsultingPlanItemMutation(id_consulting_client);

  const [planCatalogCourseId, setPlanCatalogCourseId] = useState<number | undefined>();

  const basePlanItems = useMemo(() => (planItemsData ?? []).filter((item) => item.id_center === null), [planItemsData]);
  const ownPlanItems = useMemo(
    () => (planItemsData ?? []).filter((item) => item.id_center === Number(id_center)),
    [planItemsData, id_center]
  );

  const handleAdd = async () => {
    if (!planCatalogCourseId) return;
    try {
      await addPlanItem({ id_center: Number(id_center), id_catalog_course: planCatalogCourseId });
      setPlanCatalogCourseId(undefined);
    } catch {
      message.error('No se pudo añadir la acción al plan de este centro. Puede que ya esté añadida (aquí o en el plan base).');
    }
  };

  const handleRemove = (id_plan_item: number, name: string) => {
    modal.confirm({
      title: `¿Quitar "${name}" del plan de este centro?`,
      okText: "Quitar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await removePlanItem(id_plan_item);
        } catch {
          message.error('No se pudo quitar la acción del plan. Inténtalo de nuevo.');
        }
      },
    });
  };

  const actionColumns = [
    { title: 'Acción', dataIndex: 'name' },
    { title: 'Origen', dataIndex: 'origin', render: (origin: string) => origin === 'EXTERNAL' ? 'Externo' : 'Propio' },
    { title: 'Categoría', dataIndex: 'category_name' },
    { title: 'Fecha', dataIndex: 'planning_date_name' },
  ];

  return (
    <div>
      <p>
        <Link to={`/consultoria/clients/${id_consulting_client}`}>← {clientData?.name ?? 'Cliente'}</Link>
      </p>
      <h2 style={{ marginTop: 0 }}>{centerData?.center_name ?? 'Centro'}</h2>

      <h3 style={{ marginTop: 0 }}>Plan base (heredado)</h3>
      <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
        Compartido por todos los centros del cliente — se edita desde la ficha del cliente, no aquí.
      </p>
      <Table
        rowKey="id_plan_item"
        dataSource={basePlanItems}
        pagination={false}
        columns={actionColumns}
      />

      <h3 style={{ marginTop: 32 }}>Acciones propias de este centro</h3>
      <p style={{ color: 'var(--ink-faint, #8a968d)', marginTop: -4, marginBottom: 16 }}>
        Por encima del plan base. Solo se pueden añadir acciones ya etiquetadas en <Link to="/consultoria/actions">Acciones formativas</Link>.
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
            options={(actionsData ?? []).map((a) => ({ value: a.id_catalog_course, label: a.name }))}
          />
          <Button type="primary" onClick={handleAdd} disabled={!planCatalogCourseId} loading={isAdding}>
            Añadir a este centro
          </Button>
        </div>
      </AuthzHide>
      <Table
        rowKey="id_plan_item"
        loading={isLoading}
        dataSource={ownPlanItems}
        pagination={false}
        columns={[
          ...actionColumns,
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
                  onClick={() => handleRemove(record.id_plan_item, record.name)}
                  aria-label={`Quitar ${record.name}`}
                />
              </AuthzHide>
            ),
          },
        ]}
      />
    </div>
  );
}
