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
  App
} from "antd";
const { TabPane } = Tabs;
import { 
  DatabaseOutlined, 
  LinkOutlined, 
  CheckOutlined, 
  EditOutlined, 
  CloseOutlined,
  UserAddOutlined,
  SyncOutlined,
  DisconnectOutlined
} from "@ant-design/icons";
import { useUserComparison, UserMatch, UserComparison, LinkedUserPair } from "../../hooks/api/users/tools/use-user-comparison.query";
import { useLinkUsersMutation } from "../../hooks/api/users/tools/use-link-users.mutation";
import { useUnlinkUsersMutation } from "../../hooks/api/users/tools/use-unlink-users.mutation";

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
      pagination={{ pageSize: 10 }}
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
      pagination={{ pageSize: 10 }}
      locale={{
        emptyText: <Empty description="No hay usuarios vinculados" />
      }}
    />
  );
};

const DataCrossReference = () => {
  const { modal } = App.useApp();
  const { data: comparison, isLoading, error, refetch } = useUserComparison();
  const linkUsersMutation = useLinkUsersMutation();
  const unlinkUsersMutation = useUnlinkUsersMutation();
  const [selectedMatch, setSelectedMatch] = useState<UserMatch | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const handleLink = async (bdUserId: number, moodleUserId: number) => {
    try {
      await linkUsersMutation.mutateAsync({ bdUserId, moodleUserId });
      message.success('Usuarios vinculados correctamente');
      // Refrescar los datos después de vincular
      await refetch();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al vincular usuarios');
    }
  };

  const handleUnlink = async (bdUserId: number, moodleUserId: number) => {
    try {
      await unlinkUsersMutation.mutateAsync({ bdUserId, moodleUserId });
      message.success('Usuarios desvinculados correctamente');
      // Refrescar los datos después de desvincular
      await refetch();
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
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <DatabaseOutlined style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }} />
            <Title level={2}>Cruce de Datos BD - Moodle</Title>
            <Paragraph type="secondary">
              Herramienta para cruzar y comparar datos de usuarios entre la base de datos local y la plataforma Moodle.
            </Paragraph>
            <Button 
              icon={<SyncOutlined />} 
              onClick={() => refetch()}
              loading={isLoading}
            >
              Actualizar datos
            </Button>
          </div>
          
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <Spin size="large" />
              <div style={{ marginTop: "16px" }}>
                <Text>Analizando usuarios...</Text>
              </div>
            </div>
          ) : comparison ? (
            <Tabs defaultActiveKey="exact" size="large">
              <TabPane 
                tab={
                  <span>
                    <CheckOutlined />
                    Coincidencias seguras ({counts.exact})
                  </span>
                } 
                key="exact"
              >
                <div style={{ marginBottom: "16px" }}>
                  <Alert
                    message="Coincidencias con alta confianza"
                    description="Usuarios que coinciden por email o tienen una alta similitud en nombres."
                    type="success"
                    showIcon
                  />
                </div>
                <UserMatchTable
                  matches={comparison.exactMatches}
                  onLink={handleLink}
                  onEdit={handleEdit}
                  onIgnore={handleIgnore}
                  loading={linkUsersMutation.isPending}
                />
              </TabPane>

              <TabPane 
                tab={
                  <span>
                    <EditOutlined />
                    Coincidencias dudosas ({counts.probable})
                  </span>
                } 
                key="probable"
              >
                <div style={{ marginBottom: "16px" }}>
                  <Alert
                    message="Coincidencias que requieren revisión"
                    description="Usuarios con similitud media en nombres que requieren verificación manual."
                    type="warning"
                    showIcon
                  />
                </div>
                <UserMatchTable
                  matches={comparison.probableMatches}
                  onLink={handleLink}
                  onEdit={handleEdit}
                  onIgnore={handleIgnore}
                  loading={linkUsersMutation.isPending}
                />
              </TabPane>

              <TabPane 
                tab={
                  <span>
                    <LinkOutlined />
                    Usuarios vinculados ({counts.linked})
                  </span>
                } 
                key="linked"
              >
                <div style={{ marginBottom: "16px" }}>
                  <Alert
                    message="Usuarios ya vinculados"
                    description="Usuarios de BD que ya tienen asociados usuarios de Moodle. Puedes desvincularlos si es necesario."
                    type="info"
                    showIcon
                  />
                </div>
                <LinkedUsersTable
                  linkedUsers={comparison.linkedUsers}
                  loading={unlinkUsersMutation.isPending}
                  onUnlinkWithConfirmation={handleUnlinkWithConfirmation}
                />
              </TabPane>

              <TabPane 
                tab={
                  <span>
                    <CloseOutlined />
                    Sin coincidencia ({counts.unmatchedBd + counts.unmatchedMoodle})
                  </span>
                } 
                key="unmatched"
              >
                <Alert
                  message="Usuarios sin coincidencias"
                  description="Usuarios que no tienen correspondencia entre sistemas."
                  type="info"
                  showIcon
                  style={{ marginBottom: "16px" }}
                />
                
                <div style={{ marginBottom: "24px" }}>
                  <Title level={4}>Usuarios solo en BD ({counts.unmatchedBd})</Title>
                  <Table
                    size="small"
                    columns={[
                      {
                        title: 'Nombre',
                        render: (record: any) => `${record.name} ${record.first_surname || ''} ${record.second_surname || ''}`,
                      },
                      {
                        title: 'Email',
                        dataIndex: 'email',
                      },
                      {
                        title: 'DNI',
                        dataIndex: 'dni',
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
                    dataSource={comparison.unmatched.bdUsers}
                    rowKey="id_user"
                    pagination={{ pageSize: 5 }}
                  />
                </div>

                <div>
                  <Title level={4}>Usuarios solo en Moodle ({counts.unmatchedMoodle})</Title>
                  <Table
                    size="small"
                    columns={[
                      {
                        title: 'Nombre',
                        render: (record: any) => `${record.firstname} ${record.lastname}`,
                      },
                      {
                        title: 'Email',
                        dataIndex: 'email',
                      },
                      {
                        title: 'Username',
                        dataIndex: 'username',
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
                    dataSource={comparison.unmatched.moodleUsers}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                  />
                </div>
              </TabPane>
            </Tabs>
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
  );
};

export default DataCrossReference;