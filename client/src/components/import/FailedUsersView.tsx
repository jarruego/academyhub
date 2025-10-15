import React, { useState } from 'react'
import { Table, Card, Pagination, Tag, Typography, Alert, Descriptions, Modal, Tooltip, Space, Statistic, Row, Col } from 'antd'
import { ExclamationCircleOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useFailedUsers, useFailedUsersStats } from '../../hooks/api/import'

const { Title, Text } = Typography

interface FailedUser {
  id: number
  dni: string
  name: string
  first_surname: string
  second_surname?: string
  email?: string
  import_id: string
  nss?: string
  company_name: string
  center_name: string
  failure_reason: string
  import_source: string
  created_at: string
}

export const FailedUsersView: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedUser, setSelectedUser] = useState<FailedUser | null>(null)
  const [detailsVisible, setDetailsVisible] = useState(false)

  const { data: failedUsers, isLoading: usersLoading, error: usersError } = useFailedUsers(currentPage, pageSize)
  const { data: stats, isLoading: statsLoading } = useFailedUsersStats()

  const columns = [
    {
      title: 'DNI',
      dataIndex: 'dni',
      key: 'dni',
      width: 120,
      render: (dni: string) => <Text strong>{dni}</Text>,
    },
    {
      title: 'Nombre Completo',
      key: 'fullName',
      width: 200,
      render: (record: FailedUser) => (
        <span>
          {record.name} {record.first_surname} {record.second_surname || ''}
        </span>
      ),
    },
    {
      title: 'Empresa',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (name: string) => (
        <Tooltip placement="topLeft" title={name}>
          {name}
        </Tooltip>
      ),
    },
    {
      title: 'Centro',
      dataIndex: 'center_name',
      key: 'center_name',
      width: 150,
      ellipsis: {
        showTitle: false,
      },
      render: (name: string) => (
        <Tooltip placement="topLeft" title={name}>
          {name}
        </Tooltip>
      ),
    },
    {
      title: 'Razón del Fallo',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      ellipsis: {
        showTitle: false,
      },
      render: (reason: string) => (
        <Tooltip placement="topLeft" title={reason}>
          <Tag color="red" icon={<ExclamationCircleOutlined />}>
            {reason.length > 40 ? `${reason.substring(0, 40)}...` : reason}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (record: FailedUser) => (
        <Space size="small">
          <Tooltip title="Ver detalles">
            <EyeOutlined 
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => {
                setSelectedUser(record)
                setDetailsVisible(true)
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page)
    if (size) {
      setPageSize(size)
    }
  }

  if (usersError) {
    return (
      <Alert
        message="Error al cargar usuarios fallidos"
        description={usersError.message}
        type="error"
        showIcon
      />
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> Usuarios Fallidos en Importación
      </Title>
      
      <Text type="secondary">
        Esta sección muestra todos los usuarios que no pudieron ser importados correctamente durante el proceso de importación de SAGE.
        Todos estos registros se han guardado para evitar la pérdida de datos.
      </Text>

      {/* Estadísticas */}
      {stats && !statsLoading && (
        <Card style={{ marginTop: 16, marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Total de Usuarios Fallidos"
                value={stats.total}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Empresas Afectadas"
                value={stats.companies}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Centros Afectados"
                value={stats.centers}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Tipos de Errores"
                value={stats.uniqueErrors}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Tabla de usuarios fallidos */}
      <Card>
        <Table
          columns={columns}
          dataSource={failedUsers?.users || []}
          loading={usersLoading}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1000 }}
          size="small"
        />
        
        {failedUsers && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={failedUsers.pagination.total}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) =>
                `${range[0]}-${range[1]} de ${total} usuarios fallidos`
              }
              onChange={handlePageChange}
              onShowSizeChange={handlePageChange}
            />
          </div>
        )}
      </Card>

      {/* Modal de detalles */}
      <Modal
        title={
          <span>
            <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
            Detalles del Usuario Fallido
          </span>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={null}
        width={700}
      >
        {selectedUser && (
          <div>
            <Descriptions
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="DNI" span={1}>
                <Text strong>{selectedUser.dni}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="ID Importación" span={1}>
                {selectedUser.import_id}
              </Descriptions.Item>
              <Descriptions.Item label="Nombre" span={1}>
                {selectedUser.name}
              </Descriptions.Item>
              <Descriptions.Item label="Primer Apellido" span={1}>
                {selectedUser.first_surname}
              </Descriptions.Item>
              <Descriptions.Item label="Segundo Apellido" span={1}>
                {selectedUser.second_surname || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Email" span={1}>
                {selectedUser.email || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="NSS" span={1}>
                {selectedUser.nss || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Empresa" span={1}>
                {selectedUser.company_name}
              </Descriptions.Item>
              <Descriptions.Item label="Centro" span={2}>
                {selectedUser.center_name}
              </Descriptions.Item>
              <Descriptions.Item label="Fecha de Fallo" span={1}>
                {new Date(selectedUser.created_at).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Fuente" span={1}>
                <Tag color="blue">{selectedUser.import_source.toUpperCase()}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Alert
              message="Razón del Fallo"
              description={selectedUser.failure_reason}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default FailedUsersView