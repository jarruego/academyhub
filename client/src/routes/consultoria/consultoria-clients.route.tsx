import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useConsultingClientsQuery } from "../../hooks/api/consulting-client/use-consulting-clients.query";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { normalizeLoose, matchesLoose } from "../../utils/normalize-search";

export default function ConsultoriaClientsRoute() {
  const { data: clientsData, isLoading: isClientsLoading } = useConsultingClientsQuery();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  const normalizedSearch = normalizeLoose(searchText);
  const filteredClients = clientsData?.filter((client) =>
    matchesLoose(normalizedSearch, [client.name])
  );

  const toolbar = (
    <>
      <Input.Search
        id="consulting-clients-search"
        placeholder="Buscar por nombre"
        style={{ minWidth: 320 }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        aria-label="Buscar clientes"
      />
      <AuthzHide roles={[Role.ADMIN, Role.CONSULTOR]}>
        <Button type="primary" onClick={() => navigate('/consultoria/add-client')} icon={<PlusOutlined />}>Añadir Cliente</Button>
      </AuthzHide>
    </>
  );

  return <ListPageLayout title="Consultoría · Clientes" toolbar={toolbar}>
    <DataTable
      rowKey="id_consulting_client"
      columns={[
        {
          title: 'Nombre',
          dataIndex: 'name',
          sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
        },
      ]}
      dataSource={filteredClients}
      loading={isClientsLoading}
      getRowUrl={(record) => `/consultoria/clients/${record.id_consulting_client}`}
    />
  </ListPageLayout>
}
