import { Button, Table, Input, message } from "antd";
import { useState, useEffect, useMemo, useRef } from "react";
import { Select } from "antd";
import { useUsersQuery, UsersQueryParams } from "../../hooks/api/users/use-users.query";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useNavigate } from 'react-router-dom';
import { PlusOutlined } from "@ant-design/icons"; 
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useDebounce } from "../../hooks/use-debounce";
import { User } from "../../shared/types/user/user";
import { TablePaginationConfig } from "antd/es/table";

export default function UsersRoute() {
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const navigate = useNavigate();

  // Debounce search para evitar muchas consultas
  const debouncedSearchText = useDebounce(searchText, 500);

  // Normalizar texto de búsqueda: eliminar espacios extras y normalizar acentos
  const normalizedSearchText = useMemo(() => {
    if (!debouncedSearchText) return "";
    return debouncedSearchText
      .trim()
      .replace(/\s+/g, ' ') // Reemplazar múltiples espacios por uno solo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .toLowerCase();
  }, [debouncedSearchText]);

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
  const [tableScrollY, setTableScrollY] = useState<number | undefined>(400);

  useEffect(() => {
    const MIN_TABLE_HEIGHT = 220; // px
    const FOOTER_AND_PAGINATION = 120; // px

    const compute = () => {
      // Try to detect a fixed header (common selectors), otherwise fallback to wrapper top
      const headerSelectors = ['.ant-layout-header', 'header', '.app-header'];
      let headerHeight = 0;
      for (const sel of headerSelectors) {
        const el = document.querySelector(sel) as Element | null;
        if (el) {
          headerHeight = el.getBoundingClientRect().height || 0;
          break;
        }
      }

      const wrapperTop = wrapperRef.current?.getBoundingClientRect().top ?? 0;
      const topOffset = headerHeight || wrapperTop || 0;

      const controlsH = controlsRef.current?.getBoundingClientRect().height ?? 0;
      const available = Math.max(window.innerHeight - topOffset - 16, MIN_TABLE_HEIGHT);
      const tableBody = Math.max(MIN_TABLE_HEIGHT, Math.floor(available - controlsH - FOOTER_AND_PAGINATION));
      setTableScrollY(tableBody);
    };

    // Run an initial compute and then schedule a second pass after layout settles.
    // This helps when the page is fully reloaded (F5) and some elements or fonts
    // haven't been measured yet — the delayed runs catch the final sizes.
    compute();

    // Also recompute when the full window load event fires (images/fonts/layout done)
    window.addEventListener('load', compute);
    window.addEventListener('resize', compute);

    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('load', compute);
    };
  }, []);

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
          title: 'ID',
          dataIndex: 'id_user',
          sorter: (a: User, b: User) => a.id_user - b.id_user,
          width: 80,
        },
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
      ]} 
      onRow={(record: User) => ({
        onDoubleClick: () => navigate(`/users/${record.id_user}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}
