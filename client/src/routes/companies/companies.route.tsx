import { Button, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { DataTable } from "../../components/common/DataTable";
import { normalizeLoose, matchesLoose } from "../../utils/normalize-search";

export default function CompaniesRoute() {
  const { data: companiesData, isLoading: isCompaniesLoading } = useCompaniesQuery();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    document.title = "Empresas";
  }, []);

  const normalizedSearch = normalizeLoose(searchText);
  const filteredCompanies = companiesData?.filter((company) =>
    matchesLoose(normalizedSearch, [company.company_name, company.corporate_name, company.cif])
  );

  return <div>
    <div className="list-controls">
      <Input.Search
        id="companies-search"
        placeholder="Buscar por nombre, razón social o CIF"
        style={{ minWidth: 320 }}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        aria-label="Buscar empresas"
      />
      <AuthzHide roles={[Role.ADMIN]}>
        <Button type="primary" onClick={() => navigate('/add-company')} icon={<PlusOutlined />}>Añadir Empresa</Button>
      </AuthzHide>
    </div>
    <DataTable
      rowKey="id_company"
      columns={[
        {
          title: 'ID',
          dataIndex: 'id_company',
          sorter: (a, b) => a.id_company - b.id_company,
        },
        {
          title: 'Nombre',
          dataIndex: 'company_name',
          sorter: (a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? ''),
        },
        {
          title: 'Razón Social',
          dataIndex: 'corporate_name',
          sorter: (a, b) => (a.corporate_name ?? '').localeCompare(b.corporate_name ?? ''),
        },
        {
          title: 'CIF',
          dataIndex: 'cif',
          sorter: (a, b) => (a.cif ?? '').localeCompare(b.cif ?? ''),
        },
        {
          title: 'Nº de Centros',
          dataIndex: 'center_count',
          align: 'right',
          sorter: (a, b) => (a.center_count ?? 0) - (b.center_count ?? 0),
          render: (value) => value ?? 0,
        },
        {
          title: 'Trabajadores (Histórico)',
          dataIndex: 'user_count',
          align: 'right',
          sorter: (a, b) => (a.user_count ?? 0) - (b.user_count ?? 0),
          render: (value) => value ?? 0,
        },
        {
          title: 'Activos',
          dataIndex: 'active_count',
          align: 'right',
          sorter: (a, b) => (a.active_count ?? 0) - (b.active_count ?? 0),
          render: (value) => value ?? 0,
        },
        {
          title: 'Bajas',
          dataIndex: 'inactive_count',
          align: 'right',
          sorter: (a, b) => (a.inactive_count ?? 0) - (b.inactive_count ?? 0),
          render: (value) => value ?? 0,
        },
      ]}
      dataSource={filteredCompanies}
      loading={isCompaniesLoading}
      getRowUrl={(record) => `/companies/${record.id_company}`}
    />
  </div>
}
