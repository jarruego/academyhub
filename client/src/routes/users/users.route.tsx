import { App, Button, Input, Checkbox, Select } from "antd";
import { useEffect, useState } from "react";
import { useUsersQuery, UsersQueryParams, FormationType } from "../../hooks/api/users/use-users.query";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { User } from "../../shared/types/user/user";
import { BajaTag } from "../../components/common/tags";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { useListSearch } from "../../hooks/use-list-search";
import { useListPagination } from "../../hooks/use-list-pagination";

export default function UsersRoute() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { searchText, setSearchText, normalized: normalizedSearchText } = useListSearch();

  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined);
  const [selectedCenter, setSelectedCenter] = useState<string | undefined>(undefined);
  const [formationType, setFormationType] = useState<FormationType | undefined>(undefined);
  const [showInactive, setShowInactive] = useState(true);

  const { data: companies } = useCompaniesQuery();
  const { data: centers } = useCentersQuery(selectedCompany);

  const { pagination, currentPage, pageSize, resetPage, handleTableChange } = useListPagination(0, "usuarios");

  const queryParams: UsersQueryParams = {
    page: currentPage,
    limit: pageSize,
    search: normalizedSearchText,
    id_company: selectedCompany,
    id_center: selectedCenter,
    formation_type: formationType,
    includeInactive: showInactive,
  };

  const { data: usersResponse, isLoading: isUsersLoading, error } = useUsersQuery(queryParams);

  useEffect(() => {
    if (error) {
      message.error("Error al cargar usuarios");
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    resetPage();
  };

  const toolbar = (
    <>
      <Input.Search
        id="users-search"
        placeholder="Buscar usuarios (nombre, apellido, email, DNI, centro, empresa)"
        style={{ minWidth: 260 }}
        value={searchText}
        onChange={handleSearch}
        loading={isUsersLoading}
        aria-label="Buscar usuarios"
        allowClear
      />
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Filtrar por empresa"
        style={{ width: 220 }}
        value={selectedCompany}
        onChange={(val: string | undefined) => { setSelectedCompany(val); setSelectedCenter(undefined); resetPage(); }}
        filterOption={(input, option) => {
          const label = (option?.label ?? '') as string;
          return label.toLowerCase().includes(String(input).toLowerCase());
        }}
        options={(companies || []).slice().sort((a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? '')).map(c => ({ label: c.company_name, value: String(c.id_company) }))}
      />
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Filtrar por centro"
        style={{ width: 220 }}
        value={selectedCenter}
        onChange={(val: string | undefined) => { setSelectedCenter(val); resetPage(); }}
        filterOption={(input, option) => {
          const label = (option?.label ?? '') as string;
          return label.toLowerCase().includes(String(input).toLowerCase());
        }}
        options={(centers || []).slice().sort((a, b) => (a.center_name ?? '').localeCompare(b.center_name ?? '')).map(c => ({ label: c.center_name, value: String(c.id_center) }))}
      />
      <Select
        allowClear
        placeholder="Tipo de formación"
        style={{ width: 180 }}
        value={formationType}
        onChange={(val: FormationType | undefined) => { setFormationType(val); resetPage(); }}
        options={[
          { label: 'FUNDAE', value: 'fundae' },
          { label: 'Pública', value: 'publica' },
          { label: 'INAEM', value: 'inaem' },
          { label: 'Privada', value: 'privada' },
        ]}
      />
      <Checkbox
        checked={showInactive}
        onChange={(e) => { setShowInactive(e.target.checked); resetPage(); }}
      >
        Mostrar dados de baja
      </Checkbox>
      <AuthzHide roles={[Role.ADMIN]}>
        <Button
          onClick={() => navigate('/users/create')}
          type="primary"
          icon={<PlusOutlined />}
        >
          Añadir Usuario
        </Button>
      </AuthzHide>
    </>
  );

  return (
    <ListPageLayout title="Usuarios" toolbar={toolbar}>
      {({ scrollY }) => (
        <DataTable<User>
          rowKey="id_user"
          loading={isUsersLoading}
          dataSource={usersResponse?.data || []}
          pagination={{ ...pagination, total: usersResponse?.total || 0 }}
          onChange={handleTableChange}
          scrollY={scrollY}
          getRowUrl={(record) => {
            const uid = Number(record.id_user);
            return Number.isFinite(uid) ? `/users/${uid}` : undefined;
          }}
          columns={[
            {
              title: 'DNI',
              dataIndex: 'dni',
              sorter: (a: User, b: User) => (a.dni ?? '').localeCompare(b.dni ?? ''),
              width: 120,
            },
            {
              title: 'Nombre',
              dataIndex: 'name',
              sorter: (a: User, b: User) => (a.name ?? '').localeCompare(b.name ?? ''),
              width: 150,
              render: (_, user: User) => <>{user.name}<BajaTag user={user} /></>,
            },
            {
              title: 'Apellidos',
              dataIndex: 'first_surname',
              sorter: (a: User, b: User) => (a.first_surname ?? '').localeCompare(b.first_surname ?? ''),
              width: 200,
              render: (_, user: User) => `${user.first_surname ?? ''} ${user.second_surname ?? ''}`.trim(),
            },
            {
              title: 'Email',
              dataIndex: 'email',
              sorter: (a: User, b: User) => (a.email ?? '').localeCompare(b.email ?? ''),
              width: 200,
            },
            {
              title: 'Centro',
              render: (_, user: User) => (user.centers?.find(c => c.is_main_center)?.center_name ?? user.centers?.[0]?.center_name ?? '-'),
              sorter: (a: User, b: User) => {
                const ca = a.centers?.find(c => c.is_main_center)?.center_name ?? a.centers?.[0]?.center_name ?? '';
                const cb = b.centers?.find(c => c.is_main_center)?.center_name ?? b.centers?.[0]?.center_name ?? '';
                return ca.localeCompare(cb);
              },
              width: 150,
            },
            {
              title: 'Empresa',
              render: (_, user: User) => (user.centers?.find(c => c.is_main_center)?.company_name ?? user.centers?.[0]?.company_name ?? '-'),
              sorter: (a: User, b: User) => {
                const ca = a.centers?.find(c => c.is_main_center)?.company_name ?? a.centers?.[0]?.company_name ?? '';
                const cb = b.centers?.find(c => c.is_main_center)?.company_name ?? b.centers?.[0]?.company_name ?? '';
                return ca.localeCompare(cb);
              },
              width: 200,
            },
            {
              title: 'NSS',
              dataIndex: 'nss',
              sorter: (a: User, b: User) => (a.nss ?? '').localeCompare(b.nss ?? ''),
              width: 160,
            },
          ]}
        />
      )}
    </ListPageLayout>
  );
}
