import { Button, Table, Input, message } from "antd";
import { useState, useEffect, useMemo } from "react";
import { useUsersQuery } from "../../hooks/api/users/use-users.query";
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

  const { data: usersResponse, isLoading: isUsersLoading, error } = useUsersQuery({
    page: currentPage,
    limit: pageSize,
    search: normalizedSearchText
  });

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

  return <div>
    <Input.Search 
      id="users-search"
      placeholder="Buscar usuarios (nombre, apellido, email, DNI, centro, empresa)" 
      style={{ marginBottom: 16 }} 
      value={searchText}
      onChange={handleSearch}
      loading={isUsersLoading}
      aria-label="Buscar usuarios"
      allowClear
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
    <Table 
      rowKey="id_user" 
      sortDirections={['ascend', 'descend']}
      loading={isUsersLoading}
      dataSource={usersResponse?.data || []}
      pagination={paginationConfig}
      onChange={handleTableChange}
      scroll={{ x: 'max-content' }}
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
