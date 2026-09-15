import { Button, Input, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { useConsultingActionsQuery } from "../../hooks/api/consulting-action/use-consulting-actions.query";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { normalizeLoose, matchesLoose } from "../../utils/normalize-search";

export default function ConsultoriaActionsRoute() {
  const { data: actionsData, isLoading: isActionsLoading } = useConsultingActionsQuery();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  const normalizedSearch = normalizeLoose(searchText);
  const filteredActions = actionsData?.filter((action) =>
    matchesLoose(normalizedSearch, [action.name, action.category_name])
  );

  const toolbar = (
    <>
      <Input.Search
        id="consulting-actions-search"
        placeholder="Buscar por nombre o categoría"
        style={{ minWidth: 320 }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        aria-label="Buscar acciones formativas"
      />
      <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
        <Button type="primary" onClick={() => navigate('/consultoria/actions/add')} icon={<PlusOutlined />}>Añadir Acción Formativa</Button>
      </AuthzHide>
    </>
  );

  return <ListPageLayout title="Consultoría · Acciones formativas" toolbar={toolbar}>
    <DataTable
      rowKey="id_catalog_course"
      columns={[
        {
          title: 'Acción',
          dataIndex: 'name',
          sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
        },
        {
          title: 'Origen',
          dataIndex: 'origin',
          render: (value) => value === 'OWN'
            ? <Tag color="blue">Propia</Tag>
            : <Tag color="orange">Externa</Tag>,
        },
        {
          title: 'Categoría',
          dataIndex: 'category_name',
          render: (value) => value ?? '—',
        },
        {
          title: 'Fecha',
          dataIndex: 'planning_date_name',
          render: (value) => value ?? '—',
        },
        {
          title: 'Modalidad',
          dataIndex: 'modality',
          render: (value) => value ?? '—',
        },
        {
          title: 'Horas',
          dataIndex: 'hours',
          align: 'right',
          render: (value) => value ?? '—',
        },
      ]}
      dataSource={filteredActions}
      loading={isActionsLoading}
      getRowUrl={(record) => `/consultoria/actions/${record.id_catalog_course}`}
    />
  </ListPageLayout>
}
