import { Button, Table, Input, message } from "antd";
import { useState, useEffect, useMemo, useRef } from "react";
import useTableScroll from "../../hooks/use-table-scroll";
import { Select } from "antd";
import { useUsersQuery, UsersQueryParams } from "../../hooks/api/users/use-users.query";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from "@ant-design/icons"; 
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useDebounce } from "../../hooks/use-debounce";
import { normalizeSearch } from "../../utils/normalize-search";
import { User } from "../../shared/types/user/user";
import { TablePaginationConfig } from "antd/es/table";

export default function UsersRoute() {
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const navigate = useNavigate();

  // Debounce search para evitar muchas consultas
  const debouncedSearchText = useDebounce(searchText, 500);

  // Normalizar texto de búsqueda: eliminar espacios extras, normalizar acentos y caracteres especiales
  const normalizedSearchText = useMemo(() => normalizeSearch(debouncedSearchText), [debouncedSearchText]);

  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined);
  const [selectedCenter, setSelectedCenter] = useState<string | undefined>(undefined);

  const { data: companies } = useCompaniesQuery();
  const { data: centers } = useCentersQuery(selectedCompany);

  const queryParams: UsersQueryParams = {
    page: currentPage,
    limit: pageSize,
    search: normalizedSearchText,
    id_company: selectedCompany,
    id_center: selectedCenter,
  };

  const { data: usersResponse, isLoading: isUsersLoading, error } = useUsersQuery(queryParams);

  // Refs to measure available space and compute table body height for internal scroll
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const tableScrollY = useTableScroll(wrapperRef, controlsRef);

  useEffect(() => {
    document.title = "Usuarios";
  }, []);

  useEffect(() => {
    if (error) {
      message.error("Error al cargar usuarios");
    }
  }, [error]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setCurrentPage(1); // Resetear a la primera página cuando se busca
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setCurrentPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 100);
  };

  // Configuración de paginación
  const paginationConfig = useMemo(() => ({
    current: currentPage,
    pageSize: pageSize,
    total: usersResponse?.total || 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => 
      `${range[0]}-${range[1]} de ${total} usuarios`,
    pageSizeOptions: ['50', '100', '200', '500'],
    onChange: (page: number, size: number) => {
      setCurrentPage(page);
      setPageSize(size);
    }
  }), [currentPage, pageSize, usersResponse?.total]);

  return <div ref={wrapperRef}>
    <div ref={controlsRef} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Input.Search 
        id="users-search"
        placeholder="Buscar usuarios (nombre, apellido, email, DNI, centro, empresa)" 
        style={{ marginBottom: 16, minWidth: 260 }} 
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
        style={{ width: 220, marginLeft: 8 }}
        value={selectedCompany}
        onChange={(val: string | undefined) => { setSelectedCompany(val); setSelectedCenter(undefined); setCurrentPage(1); }}
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
        onChange={(val: string | undefined) => { setSelectedCenter(val); setCurrentPage(1); }}
        filterOption={(input, option) => {
          const label = (option?.label ?? '') as string;
          return label.toLowerCase().includes(String(input).toLowerCase());
        }}
        options={(centers || []).slice().sort((a, b) => (a.center_name ?? '').localeCompare(b.center_name ?? '')).map(c => ({ label: c.center_name, value: String(c.id_center) }))}
      />
      <AuthzHide roles={[Role.ADMIN]}>
        <Button 
          onClick={() => navigate('/users/create')} 
          type="primary" 
          icon={<PlusOutlined />}
          style={{ marginBottom: 16 }}
        >
          Añadir Usuario
        </Button>
      </AuthzHide>
    </div>
    <Table 
      rowKey="id_user" 
      sortDirections={['ascend', 'descend']}
      loading={isUsersLoading}
      dataSource={usersResponse?.data || []}
      pagination={paginationConfig}
      onChange={handleTableChange}
      scroll={{ x: 'max-content', y: tableScrollY }}
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
        }
        ,{
          title: 'NSS',
          dataIndex: 'nss',
          sorter: (a: User, b: User) => (a.nss ?? '').localeCompare(b.nss ?? ''),
          width: 160,
        }
      ]} 
      onRow={(record: User) => ({
        onDoubleClick: () => {
            const uid = Number(record.id_user);
            if (!Number.isFinite(uid)) return;
            const url = `${window.location.origin}/users/${uid}`;
            // Open the user detail in a new tab/window
            window.open(url, '_blank', 'noopener,noreferrer');
          },
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}
