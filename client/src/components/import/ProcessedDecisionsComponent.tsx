import React, { useState } from 'react';
import { 
    Card, 
    Table, 
    Button, 
    Tag, 
    Space, 
    Typography, 
    Alert, 
    Modal, 
    Descriptions,
    message,
    Tooltip,
    Empty,
    Input
} from 'antd';
import { 
    InfoCircleOutlined, 
    UndoOutlined, 
    ExclamationCircleOutlined,
    SearchOutlined,
    FilterOutlined
} from '@ant-design/icons';
import { ProcessedDecision } from '../../types/import.types';
import { useProcessedDecisions, useRevertDecision } from '../../hooks/api/import';
import { App } from 'antd';

const { Title, Text } = Typography;

interface ProcessedDecisionModalProps {
    decision: ProcessedDecision | null;
    open: boolean;
    onClose: () => void;
}

const ProcessedDecisionModal: React.FC<ProcessedDecisionModalProps> = ({
    decision,
    open,
    onClose
}) => {
    if (!decision) return null;

    const renderCSVData = () => {
        const data = decision.csvRowData;
        if (!data || typeof data !== 'object') return null;

        return (
            <Descriptions size="small" column={2}>
                {Object.entries(data).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                        {String(value)}
                    </Descriptions.Item>
                ))}
            </Descriptions>
        );
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'link': return 'blue';
            case 'create_new': return 'green';
            case 'skip': return 'orange';
            default: return 'default';
        }
    };

    const getActionText = (action: string) => {
        switch (action) {
            case 'link': return 'Vinculado';
            case 'create_new': return 'Usuario Creado';
            case 'skip': return 'Omitido';
            default: return action;
        }
    };

    return (
        <Modal
            title={`Decisión Procesada - ${getActionText(decision.decisionAction)}`}
            open={open}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="close" onClick={onClose}>
                    Cerrar
                </Button>
            ]}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                    <Text strong>Estado de la Decisión: </Text>
                    <Tag color={getActionColor(decision.decisionAction)}>
                        {getActionText(decision.decisionAction)}
                    </Tag>
                </div>

                <div>
                    <Title level={5}>Datos del CSV</Title>
                    <Descriptions size="small" column={2}>
                        <Descriptions.Item label="DNI">{decision.dniCsv}</Descriptions.Item>
                        <Descriptions.Item label="Nombre">{decision.nameCSV}</Descriptions.Item>
                        <Descriptions.Item label="Primer Apellido">{decision.firstSurnameCSV}</Descriptions.Item>
                        {decision.secondSurnameCSV && (
                            <Descriptions.Item label="Segundo Apellido">{decision.secondSurnameCSV}</Descriptions.Item>
                        )}
                        <Descriptions.Item label="Fuente">{decision.importSource}</Descriptions.Item>
                        <Descriptions.Item label="Procesado">{new Date(decision.createdAt).toLocaleString()}</Descriptions.Item>
                    </Descriptions>
                </div>

                {decision.nameDb && (
                    <div>
                        <Title level={5}>Usuario en Base de Datos</Title>
                        <Descriptions size="small" column={2}>
                            {decision.dniDb && (
                                <Descriptions.Item label="DNI">{decision.dniDb}</Descriptions.Item>
                            )}
                            <Descriptions.Item label="Nombre">{decision.nameDb}</Descriptions.Item>
                            <Descriptions.Item label="Primer Apellido">{decision.firstSurnameDb}</Descriptions.Item>
                            {decision.secondSurnameDb && (
                                <Descriptions.Item label="Segundo Apellido">{decision.secondSurnameDb}</Descriptions.Item>
                            )}
                            {decision.emailDb && (
                                <Descriptions.Item label="Email">{decision.emailDb}</Descriptions.Item>
                            )}
                            {decision.nssDb && (
                                <Descriptions.Item label="NSS">{decision.nssDb}</Descriptions.Item>
                            )}
                            {decision.similarityScore && (
                                <Descriptions.Item label="Similitud">
                                    {(decision.similarityScore * 100).toFixed(1)}%
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    </div>
                )}

                {decision.notes && (
                    <div>
                        <Title level={5}>Notas</Title>
                        <Text>{decision.notes}</Text>
                    </div>
                )}

                <div>
                    <Title level={5}>Datos Completos del CSV</Title>
                    {renderCSVData()}
                </div>
            </Space>
        </Modal>
    );
};

export const ProcessedDecisionsComponent: React.FC = () => {
    const [selectedDecision, setSelectedDecision] = useState<ProcessedDecision | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        action: undefined as string | undefined,
        dateRange: undefined as [string, string] | undefined,
        search: ''
    });

    const { modal } = App.useApp();
    const { data: processedDecisions, isLoading, error, refetch } = useProcessedDecisions(filters);
    const revertDecisionMutation = useRevertDecision();

    const handleViewDecision = (decision: ProcessedDecision) => {
        setSelectedDecision(decision);
        setModalOpen(true);
    };

    const handleRevertDecision = (decision: ProcessedDecision) => {
        modal.confirm({
            title: 'Revertir Decisión',
            icon: <ExclamationCircleOutlined />,
            content: `¿Estás seguro de que quieres revertir la decisión "${getActionText(decision.decisionAction)}" para ${decision.nameCSV} ${decision.firstSurnameCSV}? Esto la devolverá a decisiones pendientes.`,
            onOk: async () => {
                try {
                    await revertDecisionMutation.mutateAsync({
                        decisionId: decision.id,
                        data: { reason: 'Revertida manualmente desde interfaz' }
                    });
                    message.success('Decisión revertida exitosamente');
                    refetch();
                } catch (error: any) {
                    message.error(`Error revirtiendo decisión: ${error?.message || 'Error desconocido'}`);
                }
            },
        });
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'link': return 'blue';
            case 'create_new': return 'green';
            case 'skip': return 'orange';
            default: return 'default';
        }
    };

    const getActionText = (action: string) => {
        switch (action) {
            case 'link': return 'Vinculado';
            case 'create_new': return 'Usuario Creado';
            case 'skip': return 'Omitido';
            default: return action;
        }
    };

    const canRevertDecision = (decision: ProcessedDecision) => {
        // Permitir revertir decisiones de tipo "skip" y "link"
        return decision.decisionAction === 'skip' || decision.decisionAction === 'link';
    };

    const columns = [
        {
            title: 'DNI CSV',
            dataIndex: 'dniCsv',
            key: 'dniCsv',
            width: 120,
        },
        {
            title: 'Datos CSV',
            key: 'csvData',
            render: (_: any, record: ProcessedDecision) => (
                <div>
                    <div><strong>{record.nameCSV} {record.firstSurnameCSV}</strong></div>
                    {record.secondSurnameCSV && <div>{record.secondSurnameCSV}</div>}
                </div>
            ),
        },
        {
            title: 'Decisión Tomada',
            dataIndex: 'decisionAction',
            key: 'decisionAction',
            width: 130,
            render: (action: string) => (
                <Tag color={getActionColor(action)}>
                    {getActionText(action)}
                </Tag>
            ),
            filters: [
                { text: 'Vinculado', value: 'link' },
                { text: 'Usuario Creado', value: 'create_new' },
                { text: 'Omitido', value: 'skip' }
            ],
            onFilter: (value: any, record: ProcessedDecision) => record.decisionAction === value,
        },
        {
            title: 'Fecha Procesado',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 150,
            render: (date: string) => new Date(date).toLocaleString(),
            sorter: (a: ProcessedDecision, b: ProcessedDecision) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        },
        {
            title: 'Fuente',
            dataIndex: 'importSource',
            key: 'importSource',
            width: 120,
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 150,
            render: (_: any, record: ProcessedDecision) => (
                <Space>
                    <Tooltip title="Ver detalles">
                        <Button
                            type="default"
                            size="small"
                            onClick={() => handleViewDecision(record)}
                            icon={<InfoCircleOutlined />}
                        />
                    </Tooltip>
                    {canRevertDecision(record) && (
                        <Tooltip title="Revertir decisión (devolver a pendientes)">
                            <Button
                                type="primary"
                                danger
                                size="small"
                                onClick={() => handleRevertDecision(record)}
                                icon={<UndoOutlined />}
                                loading={revertDecisionMutation.isPending}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    if (error) {
        return (
            <Alert
                message="Error cargando decisiones procesadas"
                description="No se pudieron cargar las decisiones procesadas. Intenta refrescar la página."
                type="error"
                showIcon
                action={<Button onClick={() => refetch()}>Reintentar</Button>}
            />
        );
    }

    const filteredDecisions = processedDecisions?.filter((decision: ProcessedDecision) => {
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            return (
                decision.nameCSV.toLowerCase().includes(searchLower) ||
                decision.firstSurnameCSV.toLowerCase().includes(searchLower) ||
                decision.dniCsv.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const revertibleCount = processedDecisions?.filter((d: ProcessedDecision) => 
        d.decisionAction === 'skip' || d.decisionAction === 'link'
    ).length || 0;

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>
                        <FilterOutlined style={{ marginRight: 8 }} />
                        Decisiones Procesadas
                    </Title>
                    <Space>
                        <Input
                            placeholder="Buscar por nombre o DNI"
                            prefix={<SearchOutlined />}
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            style={{ width: 200 }}
                        />
                        <Button onClick={() => refetch()}>Refrescar</Button>
                    </Space>
                </div>
                {revertibleCount > 0 && (
                    <Alert
                        style={{ marginTop: 16 }}
                        message={`${revertibleCount} decisiones pueden ser revertidas`}
                        description="Las decisiones omitidas y vinculadas pueden ser devueltas a la lista de pendientes haciendo clic en el botón de revertir."
                        type="info"
                        showIcon
                    />
                )}
            </Card>

            {isLoading ? (
                <Card>
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Text>Cargando decisiones procesadas...</Text>
                    </div>
                </Card>
            ) : !filteredDecisions?.length ? (
                <Card>
                    <Empty
                        description="No hay decisiones procesadas"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </Card>
            ) : (
                <Card>
                    <Table
                        columns={columns}
                        dataSource={filteredDecisions}
                        rowKey="id"
                        pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => 
                                `${range[0]}-${range[1]} de ${total} decisiones`
                        }}
                        scroll={{ x: 800 }}
                    />
                </Card>
            )}

            <ProcessedDecisionModal
                decision={selectedDecision}
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedDecision(null);
                }}
            />
        </Space>
    );
};