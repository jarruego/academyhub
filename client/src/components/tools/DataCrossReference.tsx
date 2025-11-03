import React, { useState } from "react";
import { 
  Card, 
  Typography, 
  Space, 
  Tabs, 
  Table, 
  Button, 
  Tag, 
  Spin, 
  Alert, 
  Modal, 
  message,
  Tooltip,
  Progress,
  Empty,
  App,
  Input
} from "antd";
import { 
  DatabaseOutlined, 
  LinkOutlined, 
  CheckOutlined, 
  EditOutlined, 
  CloseOutlined,
  UserAddOutlined,
  SyncOutlined,
  DisconnectOutlined,
  SearchOutlined
} from "@ant-design/icons";
import { getApiHost } from "../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from '../../utils/api/use-authenticated-axios.util';
import { useUserComparison, UserMatch, UserComparison, LinkedUserPair } from "../../hooks/api/users/tools/use-user-comparison.query";
import { useLinkUsersMutation } from "../../hooks/api/users/tools/use-link-users.mutation";
import { useUnlinkUsersMutation } from "../../hooks/api/users/tools/use-unlink-users.mutation";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const { Title, Paragraph, Text } = Typography;

interface UserMatchTableProps {
  matches: UserMatch[];
  onLink: (bdUserId: number, moodleUserId: number) => void;
  onEdit: (match: UserMatch) => void;
  onIgnore: (match: UserMatch) => void;
  loading?: boolean;
}

const UserMatchTable: React.FC<UserMatchTableProps> = ({ 
  matches, 
  onLink, 
  onEdit, 
  onIgnore, 
  loading = false 
}) => {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'green';
      case 'medium': return 'orange';
      case 'low': return 'red';
      default: return 'gray';
    }
  };

  const getMatchTypeText = (matchType: string) => {
    switch (matchType) {
      case 'exact_email': return 'Email exacto';
      case 'exact_dni': return 'DNI exacto';
      case 'probable_name': return 'Nombre probable';
      case 'possible_name': return 'Nombre posible';
      default: return matchType;
    }
  };

  const columns = [
    {
      title: 'Usuario BD',
      key: 'bdUser',
      sorter: (a: UserMatch, b: UserMatch) => {
        const nameA = `${a.bdUser.name} ${a.bdUser.first_surname}`.toLowerCase();
        const nameB = `${b.bdUser.name} ${b.bdUser.first_surname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (record: UserMatch) => (
        <div>
          <div><strong>{record.bdUser.name} {record.bdUser.first_surname} {record.bdUser.second_surname}</strong></div>
          <div><Text type="secondary">{record.bdUser.email}</Text></div>
          {record.bdUser.dni && <div><Text type="secondary">DNI: {record.bdUser.dni}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Usuario Moodle',
      key: 'moodleUser',
      sorter: (a: UserMatch, b: UserMatch) => {
        const nameA = `${a.moodleUser.firstname} ${a.moodleUser.lastname}`.toLowerCase();
        const nameB = `${b.moodleUser.firstname} ${b.moodleUser.lastname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (record: UserMatch) => (
        <div>
          <div><strong>{record.moodleUser.firstname} {record.moodleUser.lastname}</strong></div>
          <div><Text type="secondary">{record.moodleUser.email}</Text></div>
          <div><Text type="secondary">Username: {record.moodleUser.username}</Text></div>
        </div>
      ),
    },
    {
      title: 'Coincidencia',
      key: 'match',
      sorter: (a: UserMatch, b: UserMatch) => b.similarity - a.similarity,
      render: (record: UserMatch) => (
        <div>
          <Tag color={getConfidenceColor(record.confidence)}>
            {getMatchTypeText(record.matchType)}
          </Tag>
          <div>
            <Progress 
              percent={Math.round(record.similarity * 100)} 
              size="small" 
              status={record.confidence === 'high' ? 'success' : record.confidence === 'medium' ? 'active' : 'exception'}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (record: UserMatch) => (
        <Space>
          <Tooltip title="Confirmar vinculación">
            <Button 
              type="primary" 
              icon={<LinkOutlined />} 
              size="small"
              onClick={() => onLink(record.bdUser.id_user, record.moodleUser.id)}
            />
          </Tooltip>
          <Tooltip title="Editar correspondencia">
            <Button 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Ignorar usuario">
            <Button 
              danger 
              icon={<CloseOutlined />} 
              size="small"
              onClick={() => onIgnore(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={matches}
      rowKey={(record) => `${record.bdUser.id_user}-${record.moodleUser.id}`}
      loading={loading}
      pagination={{ pageSize: 50 }}
      size="small"
      locale={{
        emptyText: <Empty description="No se encontraron coincidencias" />
      }}
    />
  );
};

interface LinkedUsersTableProps {
  linkedUsers: LinkedUserPair[];
  loading?: boolean;
  onUnlinkWithConfirmation: (record: LinkedUserPair) => void;
}

const LinkedUsersTable: React.FC<LinkedUsersTableProps> = ({ 
  linkedUsers, 
  loading = false,
  onUnlinkWithConfirmation
}) => {
  const columns = [
    {
      title: 'Usuario BD',
      key: 'bdUser',
      sorter: (a: LinkedUserPair, b: LinkedUserPair) => {
        const nameA = `${a.bdUser.name} ${a.bdUser.first_surname}`.toLowerCase();
        const nameB = `${b.bdUser.name} ${b.bdUser.first_surname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (record: LinkedUserPair) => (
        <div>
          <div><strong>{record.bdUser.name} {record.bdUser.first_surname} {record.bdUser.second_surname}</strong></div>
          <div><Text type="secondary">{record.bdUser.email}</Text></div>
          {record.bdUser.dni && <div><Text type="secondary">DNI: {record.bdUser.dni}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Usuario Moodle',
      key: 'moodleUser',
      sorter: (a: LinkedUserPair, b: LinkedUserPair) => {
        const nameA = `${a.moodleUser.firstname} ${a.moodleUser.lastname}`.toLowerCase();
        const nameB = `${b.moodleUser.firstname} ${b.moodleUser.lastname}`.toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (record: LinkedUserPair) => (
        <div>
          <div><strong>{record.moodleUser.firstname} {record.moodleUser.lastname}</strong></div>
          <div><Text type="secondary">{record.moodleUser.email}</Text></div>
          <div><Text type="secondary">Username: {record.moodleUser.username}</Text></div>
        </div>
      ),
    },
    {
      title: 'Fecha vinculación',
      key: 'linkedAt',
      sorter: (a: LinkedUserPair, b: LinkedUserPair) => {
        if (!a.linkedAt && !b.linkedAt) return 0;
        if (!a.linkedAt) return 1;
        if (!b.linkedAt) return -1;
        return new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime();
      },
      render: (record: LinkedUserPair) => (
        <div>
          {record.linkedAt ? (
            <Text type="secondary">
              {new Date(record.linkedAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          ) : (
            <Text type="secondary">Sin fecha</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (record: LinkedUserPair) => (
        <Space>
          <Tooltip title="Desvincular usuarios">
            <Button
              icon={<DisconnectOutlined />}
              danger
              size="small"
              onClick={() => {
                onUnlinkWithConfirmation(record);
              }}
            >
              Desvincular
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={linkedUsers}
      rowKey={(record) => `linked-${record.bdUser.id_user}-${record.moodleUser.id}`}
      loading={loading}
      pagination={{ pageSize: 50 }}
      size="small"
      locale={{
        emptyText: <Empty description="No hay usuarios vinculados" />
      }}
    />
  );
};

const DataCrossReference = () => {
  const { modal } = App.useApp();
  // No ejecutar automáticamente al montar: el usuario debe pulsar "Actualizar datos"
  const { data: comparison, isLoading, isFetching, error, refetch } = useUserComparison({ enabled: false });
  const linkUsersMutation = useLinkUsersMutation();
  const unlinkUsersMutation = useUnlinkUsersMutation();
  const [selectedMatch, setSelectedMatch] = useState<UserMatch | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [setMainLoading, setSetMainLoading] = useState(false);
  
  // Estados para los filtros de búsqueda
  const [exactSearchTerm, setExactSearchTerm] = useState('');
  const [probableSearchTerm, setProbableSearchTerm] = useState('');
  const [linkedSearchTerm, setLinkedSearchTerm] = useState('');
  const [bdSearchTerm, setBdSearchTerm] = useState('');
  const [moodleSearchTerm, setMoodleSearchTerm] = useState('');

  // Funciones de filtrado
  const filterUserMatches = (matches: UserMatch[], searchTerm: string) => {
    if (!searchTerm.trim()) return matches;
    
    const term = searchTerm.toLowerCase();
    return matches.filter(match => {
      const bdUser = match.bdUser;
      const moodleUser = match.moodleUser;
      
      return (
        (bdUser.name?.toLowerCase().includes(term)) ||
        (bdUser.first_surname?.toLowerCase().includes(term)) ||
        (bdUser.second_surname?.toLowerCase().includes(term)) ||
        (bdUser.email?.toLowerCase().includes(term)) ||
        (bdUser.dni?.toLowerCase().includes(term)) ||
        (moodleUser.firstname?.toLowerCase().includes(term)) ||
        (moodleUser.lastname?.toLowerCase().includes(term)) ||
        (moodleUser.email?.toLowerCase().includes(term)) ||
        (moodleUser.username?.toLowerCase().includes(term))
      );
    });
  };

  const filterLinkedUsers = (linkedUsers: LinkedUserPair[], searchTerm: string) => {
    if (!searchTerm.trim()) return linkedUsers;
    
    const term = searchTerm.toLowerCase();
    return linkedUsers.filter(pair => {
      const bdUser = pair.bdUser;
      const moodleUser = pair.moodleUser;
      
      return (
        (bdUser.name?.toLowerCase().includes(term)) ||
        (bdUser.first_surname?.toLowerCase().includes(term)) ||
        (bdUser.second_surname?.toLowerCase().includes(term)) ||
        (bdUser.email?.toLowerCase().includes(term)) ||
        (bdUser.dni?.toLowerCase().includes(term)) ||
        (moodleUser.firstname?.toLowerCase().includes(term)) ||
        (moodleUser.lastname?.toLowerCase().includes(term)) ||
        (moodleUser.email?.toLowerCase().includes(term)) ||
        (moodleUser.username?.toLowerCase().includes(term))
      );
    });
  };

  const filterBdUsers = (users: any[], searchTerm: string) => {
    if (!searchTerm.trim()) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => (
      (user.name?.toLowerCase().includes(term)) ||
      (user.first_surname?.toLowerCase().includes(term)) ||
      (user.second_surname?.toLowerCase().includes(term)) ||
      (user.email?.toLowerCase().includes(term)) ||
      (user.dni?.toLowerCase().includes(term))
    ));
  };

  const filterMoodleUsers = (users: any[], searchTerm: string) => {
    if (!searchTerm.trim()) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => (
      (user.firstname?.toLowerCase().includes(term)) ||
      (user.lastname?.toLowerCase().includes(term)) ||
      (user.email?.toLowerCase().includes(term)) ||
      (user.username?.toLowerCase().includes(term))
    ));
  };

  const handleLink = async (bdUserId: number, moodleUserId: number) => {
    try {
      await linkUsersMutation.mutateAsync({ bdUserId, moodleUserId });
        message.success('Usuarios vinculados correctamente');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al vincular usuarios');
    }
  };

  const handleUnlink = async (bdUserId: number, moodleUserId: number) => {
    try {
      await unlinkUsersMutation.mutateAsync({ bdUserId, moodleUserId });
  message.success('Usuarios desvinculados correctamente');
    } catch (error: any) {
      console.error('🔧 Error in handleUnlink:', error);
      message.error(error.response?.data?.message || 'Error al desvincular usuarios');
    }
  };

  const handleUnlinkWithConfirmation = (record: LinkedUserPair) => {
    modal.confirm({
      title: '¿Desvincular usuarios?',
      content: `¿Estás seguro de que quieres desvincular a ${record.bdUser.name} de ${record.moodleUser.firstname} ${record.moodleUser.lastname}?`,
      okText: 'Sí, desvincular',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk() {
        handleUnlink(record.bdUser.id_user, record.moodleUser.id);
      },
    });
  };

  const handleEdit = (match: UserMatch) => {
    setSelectedMatch(match);
    setIsEditModalVisible(true);
  };

  const handleIgnore = () => {
    modal.confirm({
      title: '¿Está seguro de ignorar esta coincidencia?',
      content: 'Esta acción no vinculará estos usuarios.',
      onOk() {
        message.info('Coincidencia ignorada');
        // Aquí podrías implementar lógica para marcar como ignorado
      },
    });
  };

  const handleCreateNew = () => {
    message.info('Funcionalidad de crear nuevo usuario en desarrollo');
    // Aquí podrías redirigir a la página de crear usuario
  };

  const authRequest = useAuthenticatedAxios();

  const handleInitUsernames = () => {
    modal.confirm({
      title: 'Inicializar usernames de Moodle',
      content: 'Se establecerán todos los moodle_usernames a `user_<id_moodle_user>`. ¿Deseas continuar?',
      okText: 'Sí, inicializar',
      okType: 'danger',
      cancelText: 'Cancelar',
      async onOk() {
        try {
          setInitLoading(true);
          const resp = await authRequest({ method: 'post', url: `${getApiHost()}/moodle-user/init-usernames` });
          const initData: any = resp.data;
          message.success(initData?.message || 'Inicialización completada');
          // Notificar al usuario que puede recargar manualmente si quiere ver los cambios
          message.info('Inicialización realizada. Pulsa "Actualizar datos" para ver los cambios.');
        } catch (error: any) {
          console.error('Error inicializando usernames:', error);
          message.error(error.response?.data?.message || 'Error al inicializar usernames');
        } finally {
          setInitLoading(false);
        }
      }
    });
  };

  const handleSyncUsernames = () => {
    modal.confirm({
      title: 'Sincronizar usernames desde Moodle',
      content: 'Se descargarán los usuarios desde Moodle y se actualizarán los usernames locales cuando coincida moodle_id. ¿Deseas continuar?',
      okText: 'Sí, sincronizar',
      okType: 'primary',
      cancelText: 'Cancelar',
      async onOk() {
        try {
          setSyncLoading(true);
          const resp = await authRequest({ method: 'post', url: `${getApiHost()}/moodle/users/sync-usernames` });
          const syncData: any = resp.data;
          message.success(syncData?.message || `Sincronizados ${syncData?.updated ?? 0} de ${syncData?.totalMoodleUsers ?? 0}`);
          // Only automatically refresh the comparison if at least one record was updated.
          // This avoids triggering the "Actualizar datos" flow when nothing changed.
          if (syncData?.updated && syncData.updated > 0) {
            // No recargamos automáticamente: informar al usuario para recargar manualmente
            message.info('Sincronización completada. Pulsa "Actualizar datos" para ver los cambios.');
          } else {
            message.info('No se actualizaron usuarios. Pulsa "Actualizar datos" si quieres forzar una recarga.');
          }
        } catch (error: any) {
          console.error('Error sincronizando usernames:', error);
          message.error(error.response?.data?.message || 'Error al sincronizar usernames');
        } finally {
          setSyncLoading(false);
        }
      }
    });
  };

  if (error) {
    return (
      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
        <Alert
          message="Error al cargar datos"
          description="No se pudieron cargar los datos de comparación de usuarios."
          type="error"
          action={
            <Button size="small" danger onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  const getTabCounts = (data: UserComparison) => {
    return {
      exact: data.exactMatches.length,
      probable: data.probableMatches.length,
      linked: data.linkedUsers.length,
      unmatchedBd: data.unmatched.bdUsers.length,
      unmatchedMoodle: data.unmatched.moodleUsers.length
    };
  };

  const counts = comparison ? getTabCounts(comparison) : { exact: 0, probable: 0, linked: 0, unmatchedBd: 0, unmatchedMoodle: 0 };

  // Datos de debug eliminados

  return (
    <AuthzHide roles={[Role.ADMIN]}>
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <DatabaseOutlined style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }} />
            <Title level={2}>Cruce de Datos BD - Moodle</Title>
            <Paragraph type="secondary">
              Herramienta para cruzar y comparar datos de usuarios entre la base de datos local y la plataforma Moodle.
            </Paragraph>
            <Space>
              <Button 
                icon={<SyncOutlined />} 
                onClick={() => refetch()}
                loading={isLoading || isFetching}
              >
                Actualizar datos
              </Button>

              <Button
                icon={<UserAddOutlined />}
                onClick={handleInitUsernames}
                loading={initLoading}
                danger
              >
                Inicializar usernames
              </Button>
              <Button
                icon={<CheckOutlined />}
                onClick={async () => {
                  modal.confirm({
                    title: 'Marcar main users por moodle_id',
                    content: 'Para cada usuario local se marcará como is_main_user el registro con mayor moodle_id. ¿Deseas continuar?',
                    okText: 'Sí, ejecutar',
                    okType: 'primary',
                    cancelText: 'Cancelar',
                    async onOk() {
                      try {
                        setSetMainLoading(true);
                        const resp = await authRequest({ method: 'post', url: `${getApiHost()}/moodle-user/set-main-by-moodle-id` });
                        const data: any = resp.data;
                        message.success(data?.message || `Procesados ${data?.totalLocalUsers ?? 0} usuarios locales, actualizados ${data?.updated ?? 0} filas`);
                      } catch (error: any) {
                        console.error('Error estableciendo main users:', error);
                        message.error(error.response?.data?.message || 'Error al establecer main users');
                      } finally {
                        setSetMainLoading(false);
                      }
                    }
                  });
                }}
                loading={setMainLoading}
              >
                Normalizar main
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={handleSyncUsernames}
                loading={syncLoading}
              >
                Sincronizar desde Moodle
              </Button>
            </Space>
          </div>
          
          {(isLoading || isFetching) ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <Spin size="large" />
              <div style={{ marginTop: "16px" }}>
                <Text>Analizando usuarios...</Text>
              </div>
            </div>
          ) : comparison ? (
            <Tabs 
              defaultActiveKey="exact" 
              size="large"
              items={[
                {
                  key: "exact",
                  label: (
                    <span>
                      <CheckOutlined />
                      Coincidencias seguras ({counts.exact})
                    </span>
                  ),
                  children: (
                    <>
                      <div style={{ marginBottom: "16px" }}>
                        <Alert
                          message="Coincidencias con alta confianza"
                          description="Usuarios que coinciden por email o tienen una alta similitud en nombres."
                          type="success"
                          showIcon
                        />
                      </div>
                      
                      <div style={{ marginBottom: "16px" }}>
                        <Input
                          id="exact-search"
                          placeholder="Buscar por nombre, apellido, email, DNI o usuario..."
                          prefix={<SearchOutlined />}
                          value={exactSearchTerm}
                          onChange={(e) => setExactSearchTerm(e.target.value)}
                          allowClear
                          style={{ maxWidth: 400 }}
                          aria-label="Buscar coincidencias exactas"
                        />
                      </div>
                      
                      <UserMatchTable
                        matches={filterUserMatches(comparison.exactMatches, exactSearchTerm)}
                        onLink={handleLink}
                        onEdit={handleEdit}
                        onIgnore={handleIgnore}
                        loading={linkUsersMutation.isPending}
                      />
                    </>
                  )
                },
                {
                  key: "probable",
                  label: (
                    <span>
                      <EditOutlined />
                      Coincidencias dudosas ({counts.probable})
                    </span>
                  ),
                  children: (
                    <>
                      <div style={{ marginBottom: "16px" }}>
                        <Alert
                          message="Coincidencias que requieren revisión"
                          description="Usuarios con similitud media en nombres que requieren verificación manual."
                          type="warning"
                          showIcon
                        />
                      </div>
                      
                      <div style={{ marginBottom: "16px" }}>
                        <Input
                          id="probable-search"
                          placeholder="Buscar por nombre, apellido, email, DNI o usuario..."
                          prefix={<SearchOutlined />}
                          value={probableSearchTerm}
                          onChange={(e) => setProbableSearchTerm(e.target.value)}
                          allowClear
                          style={{ maxWidth: 400 }}
                          aria-label="Buscar coincidencias probables"
                        />
                      </div>
                      
                      <UserMatchTable
                        matches={filterUserMatches(comparison.probableMatches, probableSearchTerm)}
                        onLink={handleLink}
                        onEdit={handleEdit}
                        onIgnore={handleIgnore}
                        loading={linkUsersMutation.isPending}
                      />
                    </>
                  )
                },
                {
                  key: "linked",
                  label: (
                    <span>
                      <LinkOutlined />
                      Usuarios vinculados ({counts.linked})
                    </span>
                  ),
                  children: (
                    <>
                      <div style={{ marginBottom: "16px" }}>
                        <Alert
                          message="Usuarios ya vinculados"
                          description="Usuarios de BD que ya tienen asociados usuarios de Moodle. Puedes desvincularlos si es necesario."
                          type="info"
                          showIcon
                        />
                      </div>
                      
                      <div style={{ marginBottom: "16px" }}>
                        <Input
                          id="linked-search"
                          placeholder="Buscar por nombre, apellido, email, DNI o usuario..."
                          prefix={<SearchOutlined />}
                          value={linkedSearchTerm}
                          onChange={(e) => setLinkedSearchTerm(e.target.value)}
                          allowClear
                          style={{ maxWidth: 400 }}
                          aria-label="Buscar usuarios vinculados"
                        />
                      </div>
                      
                      <LinkedUsersTable
                        linkedUsers={filterLinkedUsers(comparison.linkedUsers, linkedSearchTerm)}
                        loading={unlinkUsersMutation.isPending}
                        onUnlinkWithConfirmation={handleUnlinkWithConfirmation}
                      />
                    </>
                  )
                },
                {
                  key: "unmatched",
                  label: (
                    <span>
                      <CloseOutlined />
                      Sin coincidencia ({counts.unmatchedBd + counts.unmatchedMoodle})
                    </span>
                  ),
                  children: (
                    <>
                      <Alert
                        message="Usuarios sin coincidencias"
                        description="Usuarios que no tienen correspondencia entre sistemas."
                        type="info"
                        showIcon
                        style={{ marginBottom: "16px" }}
                      />
                      
                      <div style={{ marginBottom: "24px" }}>
                        <Title level={4}>Usuarios solo en BD ({counts.unmatchedBd})</Title>
                        
                        <div style={{ marginBottom: "16px" }}>
                          <Input
                            id="bd-search"
                            placeholder="Buscar usuarios BD por nombre, apellido, email o DNI..."
                            prefix={<SearchOutlined />}
                            value={bdSearchTerm}
                            onChange={(e) => setBdSearchTerm(e.target.value)}
                            allowClear
                            style={{ maxWidth: 400 }}
                            aria-label="Buscar usuarios solo en BD"
                          />
                        </div>
                        
                        <Table
                          size="small"
                          columns={[
                            {
                              title: 'Nombre',
                              key: 'name',
                              sorter: (a: any, b: any) => {
                                const nameA = `${a.name} ${a.first_surname || ''}`.toLowerCase();
                                const nameB = `${b.name} ${b.first_surname || ''}`.toLowerCase();
                                return nameA.localeCompare(nameB);
                              },
                              render: (record: any) => `${record.name} ${record.first_surname || ''} ${record.second_surname || ''}`,
                            },
                            {
                              title: 'Email',
                              dataIndex: 'email',
                              sorter: (a: any, b: any) => (a.email || '').localeCompare(b.email || ''),
                            },
                            {
                              title: 'DNI',
                              dataIndex: 'dni',
                              sorter: (a: any, b: any) => (a.dni || '').localeCompare(b.dni || ''),
                            },
                            {
                              title: 'Acciones',
                              render: () => (
                                <Button 
                                  size="small" 
                                  icon={<UserAddOutlined />}
                                  onClick={handleCreateNew}
                                >
                                  Crear en Moodle
                                </Button>
                              ),
                            },
                          ]}
                          dataSource={filterBdUsers(comparison.unmatched.bdUsers, bdSearchTerm)}
                          rowKey="id_user"
                          pagination={{ pageSize: 50 }}
                        />
                      </div>

                      <div>
                        <Title level={4}>Usuarios solo en Moodle ({counts.unmatchedMoodle})</Title>
                        
                        <div style={{ marginBottom: "16px" }}>
                          <Input
                            id="moodle-search"
                            placeholder="Buscar usuarios Moodle por nombre, email o usuario..."
                            prefix={<SearchOutlined />}
                            value={moodleSearchTerm}
                            onChange={(e) => setMoodleSearchTerm(e.target.value)}
                            allowClear
                            style={{ maxWidth: 400 }}
                            aria-label="Buscar usuarios solo en Moodle"
                          />
                        </div>
                        
                        <Table
                          size="small"
                          columns={[
                            {
                              title: 'Nombre',
                              key: 'name',
                              sorter: (a: any, b: any) => {
                                const nameA = `${a.firstname} ${a.lastname}`.toLowerCase();
                                const nameB = `${b.firstname} ${b.lastname}`.toLowerCase();
                                return nameA.localeCompare(nameB);
                              },
                              render: (record: any) => `${record.firstname} ${record.lastname}`,
                            },
                            {
                              title: 'Email',
                              dataIndex: 'email',
                              sorter: (a: any, b: any) => (a.email || '').localeCompare(b.email || ''),
                            },
                            {
                              title: 'Username',
                              dataIndex: 'username',
                              sorter: (a: any, b: any) => (a.username || '').localeCompare(b.username || ''),
                            },
                            {
                              title: 'Acciones',
                              render: () => (
                                <Button 
                                  size="small" 
                                  icon={<UserAddOutlined />}
                                  onClick={handleCreateNew}
                                >
                                  Crear en BD
                                </Button>
                              ),
                            },
                          ]}
                          dataSource={filterMoodleUsers(comparison.unmatched.moodleUsers, moodleSearchTerm)}
                          rowKey="id"
                          pagination={{ pageSize: 50 }}
                        />
                      </div>
                    </>
                  )
                }
              ]}
            />
          ) : null}
        </Space>
      </Card>

      {/* Modal para editar correspondencia */}
      <Modal
        title="Editar correspondencia"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsEditModalVisible(false)}>
            Cancelar
          </Button>,
          <Button key="confirm" type="primary" onClick={() => {
            if (selectedMatch) {
              handleLink(selectedMatch.bdUser.id_user, selectedMatch.moodleUser.id);
              setIsEditModalVisible(false);
            }
          }}>
            Confirmar vinculación
          </Button>,
        ]}
      >
        {selectedMatch && (
          <div>
            <Title level={5}>Usuario BD:</Title>
            <Paragraph>
              {selectedMatch.bdUser.name} {selectedMatch.bdUser.first_surname} {selectedMatch.bdUser.second_surname}
              <br />
              Email: {selectedMatch.bdUser.email}
              <br />
              DNI: {selectedMatch.bdUser.dni}
            </Paragraph>
            
            <Title level={5}>Usuario Moodle:</Title>
            <Paragraph>
              {selectedMatch.moodleUser.firstname} {selectedMatch.moodleUser.lastname}
              <br />
              Email: {selectedMatch.moodleUser.email}
              <br />
              Username: {selectedMatch.moodleUser.username}
            </Paragraph>

            <Alert
              message={`Similitud: ${Math.round(selectedMatch.similarity * 100)}%`}
              type={selectedMatch.confidence === 'high' ? 'success' : selectedMatch.confidence === 'medium' ? 'warning' : 'error'}
            />
          </div>
        )}
      </Modal>
      </div>
    </AuthzHide>
  );
};

export default DataCrossReference;