import React, { useState } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Tag,
    Modal,
    Descriptions,
    Radio,
    Alert,
    Typography,
    Spin,
    Empty,
    Badge,
    Divider,
    App
} from 'antd';
import {
    CheckOutlined,
    CloseOutlined,
    UserAddOutlined,
    LinkOutlined,
    ExclamationCircleOutlined,
    InfoCircleOutlined,
    SyncOutlined
} from '@ant-design/icons';
import { usePendingDecisions, useProcessDecision } from '../../hooks/api/import/usePendingDecisions';
import { PendingDecision, ProcessDecisionRequest } from '../../types/import.types';
import { detectDocumentType, validateNSS } from '../../utils/detect-document-type';

const { Title, Text } = Typography;

interface DecisionModalProps {
    decision: PendingDecision | null;
    open: boolean;
    onClose: () => void;
    onProcess: (decisionId: number, data: ProcessDecisionRequest) => void;
    loading: boolean;
}

const DecisionModal: React.FC<DecisionModalProps> = ({
    decision,
    open,
    onClose,
    onProcess,
    loading
}) => {
    const [selectedAction, setSelectedAction] = useState<'link' | 'create_new' | 'skip' | 'update_and_link'>('link');
    const { modal } = App.useApp();

    if (!decision) return null;

    const handleProcess = () => {
        modal.confirm({
            title: 'Confirmar Decisión',
            icon: <ExclamationCircleOutlined />,
            content: getConfirmationMessage(selectedAction),
            onOk: () => {
                onProcess(decision.id, { action: selectedAction });
                onClose();
                setSelectedAction('link');
            },
        });
    };

    const getConfirmationMessage = (action: string) => {
        switch (action) {
            case 'link':
                return `¿Vincular ${decision.nameCSV} ${decision.firstSurnameCSV} con el usuario existente ${decision.nameDb} ${decision.firstSurnameDb}?`;
            case 'create_new':
                return `¿Crear un nuevo usuario para ${decision.nameCSV} ${decision.firstSurnameCSV}?`;
            case 'skip':
                return `¿Omitir el procesamiento de ${decision.nameCSV} ${decision.firstSurnameCSV}?`;
            default:
                return '¿Confirmar la acción seleccionada?';
        }
    };

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

    // Función para normalizar strings para comparación (sin acentos, minúsculas, sin espacios extra)
    const normalizeForComparison = (text: string | null | undefined): string => {
        if (!text) return '';
        return text.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    // Función para comparar dos valores y devolver estilos si son diferentes
    const compareFields = (csvValue: string | null | undefined, dbValue: string | null | undefined) => {
        const csvNormalized = normalizeForComparison(csvValue);
        const dbNormalized = normalizeForComparison(dbValue);
        
        const isDifferent = csvNormalized !== dbNormalized && csvNormalized !== '' && dbNormalized !== '';
        
        return {
            isDifferent,
            style: isDifferent ? { color: 'red', fontWeight: 'bold' } : {}
        };
    };

    // Obtener valores para comparación
    const csvNss = decision.csvRowData?.['Personas.ProvNumSoe'] || decision.csvRowData?.['NSS'];
    const csvEmail = decision.csvRowData?.['email'] || decision.csvRowData?.['Email'] || decision.csvRowData?.['mail'];

    return (
        <Modal
            title={`Decisión Manual - Similitud ${(decision.similarityScore * 100).toFixed(1)}%`}
            open={open}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Cancelar
                </Button>,
                <Button
                    key="process"
                    type="primary"
                    loading={loading}
                    onClick={handleProcess}
                    icon={selectedAction === 'link' ? <LinkOutlined /> : 
                          selectedAction === 'update_and_link' ? <SyncOutlined /> :
                          selectedAction === 'create_new' ? <UserAddOutlined /> : <CloseOutlined />}
                >
                    {selectedAction === 'link' ? 'Vincular' :
                     selectedAction === 'update_and_link' ? 'Actualizar y Vincular' :
                     selectedAction === 'create_new' ? 'Crear Nuevo' : 'Omitir'}
                </Button>
            ]}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                    message="Posible Coincidencia Detectada"
                    description={`Se encontró un usuario similar en la base de datos con ${(decision.similarityScore * 100).toFixed(1)}% de similitud. Decide cómo proceder.`}
                    type="warning"
                    showIcon
                />

                <div>
                    <Title level={5}>Comparación de Datos</Title>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Card size="small" title="Datos del CSV" extra={<Tag color="blue">Nuevo</Tag>}>
                            <Descriptions size="small" column={1}>
                                <Descriptions.Item label="DNI">
                                    <span style={compareFields(decision.dniCsv, decision.dniDb).style}>
                                        {decision.dniCsv}
                                        {detectDocumentType(decision.dniCsv) === undefined && (
                                            <Tag color="red" style={{ marginLeft: 6 }}>DNI/NIE inválido</Tag>
                                        )}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Nombre">
                                    <span style={compareFields(decision.nameCSV, decision.nameDb).style}>
                                        {decision.nameCSV}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Primer Apellido">
                                    <span style={compareFields(decision.firstSurnameCSV, decision.firstSurnameDb).style}>
                                        {decision.firstSurnameCSV}
                                    </span>
                                </Descriptions.Item>
                                {decision.secondSurnameCSV && (
                                    <Descriptions.Item label="Segundo Apellido">
                                        <span style={compareFields(decision.secondSurnameCSV, decision.secondSurnameDb).style}>
                                            {decision.secondSurnameCSV}
                                        </span>
                                    </Descriptions.Item>
                                )}
                                <Descriptions.Item label="NSS">
                                    <span style={compareFields(csvNss, decision.nssDb).style}>
                                        {csvNss || 'Vacío'}
                                        {csvNss && !validateNSS(csvNss) && (
                                            <Tag color="red" style={{ marginLeft: 6 }}>NSS inválido</Tag>
                                        )}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Email">
                                    <span style={compareFields(csvEmail, decision.emailDb).style}>
                                        {csvEmail || 'Vacío'}
                                    </span>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card size="small" title="Usuario en BD" extra={<Tag color="green">Existente</Tag>}>
                            <Descriptions size="small" column={1}>
                                <Descriptions.Item label="DNI">
                                    <span style={compareFields(decision.dniCsv, decision.dniDb).style}>
                                        {decision.dniDb || 'Vacío'}
                                        {decision.dniDb && detectDocumentType(decision.dniDb) === undefined && (
                                            <Tag color="red" style={{ marginLeft: 6 }}>DNI/NIE inválido</Tag>
                                        )}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Nombre">
                                    <span style={compareFields(decision.nameCSV, decision.nameDb).style}>
                                        {decision.nameDb}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Primer Apellido">
                                    <span style={compareFields(decision.firstSurnameCSV, decision.firstSurnameDb).style}>
                                        {decision.firstSurnameDb}
                                    </span>
                                </Descriptions.Item>
                                {decision.secondSurnameDb && (
                                    <Descriptions.Item label="Segundo Apellido">
                                        <span style={compareFields(decision.secondSurnameCSV, decision.secondSurnameDb).style}>
                                            {decision.secondSurnameDb}
                                        </span>
                                    </Descriptions.Item>
                                )}
                                <Descriptions.Item label="NSS">
                                    <span style={compareFields(csvNss, decision.nssDb).style}>
                                        {decision.nssDb || 'Vacío'}
                                        {decision.nssDb && !validateNSS(decision.nssDb) && (
                                            <Tag color="red" style={{ marginLeft: 6 }}>NSS inválido</Tag>
                                        )}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label="Email">
                                    <span style={compareFields(csvEmail, decision.emailDb).style}>
                                        {decision.emailDb || 'Vacío'}
                                    </span>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>
                    </div>
                </div>

                <div>
                    <Title level={5}>Acción a Realizar</Title>
                    <Radio.Group value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
                        <Space direction="vertical">
                            <Radio value="link">
                                <Space>
                                    <LinkOutlined />
                                    <strong>Vincular con usuario existente</strong>
                                    <Text type="secondary">- Los datos del CSV se asociarán al usuario existente</Text>
                                </Space>
                            </Radio>
                            <Radio value="update_and_link">
                                <Space>
                                    <SyncOutlined />
                                    <strong>Actualizar y vincular usuario existente</strong>
                                    <Text type="secondary">- Se actualizarán los datos del usuario y se vinculará (ej: cambio NIE → DNI)</Text>
                                </Space>
                            </Radio>
                            <Radio value="create_new">
                                <Space>
                                    <UserAddOutlined />
                                    <strong>Crear nuevo usuario</strong>
                                    <Text type="secondary">- Se creará un usuario completamente nuevo</Text>
                                </Space>
                            </Radio>
                            <Radio value="skip">
                                <Space>
                                    <CloseOutlined />
                                    <strong>Omitir registro</strong>
                                    <Text type="secondary">- No se procesará este registro</Text>
                                </Space>
                            </Radio>
                        </Space>
                    </Radio.Group>
                </div>

                <div>
                    <Title level={5}>Datos Completos del CSV</Title>
                    <Card size="small">
                        {renderCSVData()}
                    </Card>
                </div>
            </Space>
        </Modal>
    );
};

export const PendingDecisionsComponent: React.FC = () => {
    const [selectedDecision, setSelectedDecision] = useState<PendingDecision | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const { modal, message } = App.useApp();

    const { data: pendingDecisions, isLoading, error, refetch } = usePendingDecisions();
    const processDecisionMutation = useProcessDecision();

    const handleViewDecision = (decision: PendingDecision) => {
        setSelectedDecision(decision);
        setModalOpen(true);
    };

    const handleProcessDecision = async (decisionId: number, data: ProcessDecisionRequest) => {
        try {
            await processDecisionMutation.mutateAsync({ decisionId, data });
            message.success('Decisión procesada exitosamente');
            refetch();
        } catch (error: any) {
            message.error(`Error procesando decisión: ${error?.message || 'Error desconocido'}`);
        }
    };

    const handleBulkProcess = (action: 'link' | 'create_new' | 'skip' | 'update_and_link') => {
        if (!pendingDecisions?.length) return;

        modal.confirm({
            title: `Procesar ${pendingDecisions.length} decisiones`,
            icon: <ExclamationCircleOutlined />,
            content: `¿Estás seguro de que quieres ${action === 'link' ? 'vincular' : action === 'create_new' ? 'crear nuevos usuarios para' : 'omitir'} todas las decisiones pendientes?`,
            onOk: async () => {
                try {
                    for (const decision of pendingDecisions) {
                        await processDecisionMutation.mutateAsync({
                            decisionId: decision.id,
                            data: { action }
                        });
                    }
                    message.success(`${pendingDecisions.length} decisiones procesadas exitosamente`);
                    refetch();
                } catch (error: any) {
                    message.error(`Error en procesamiento masivo: ${error?.message || 'Error desconocido'}`);
                }
            },
        });
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
            render: (_: any, record: PendingDecision) => (
                <div>
                    <div><strong>{record.nameCSV} {record.firstSurnameCSV}</strong></div>
                    {record.secondSurnameCSV && <div><Text type="secondary">{record.secondSurnameCSV}</Text></div>}
                </div>
            ),
        },
        {
            title: 'Usuario Similar en BD',
            key: 'dbData',
            render: (_: any, record: PendingDecision) => (
                <div>
                    <div><strong>{record.nameDb} {record.firstSurnameDb}</strong></div>
                    {record.secondSurnameDb && <div><Text type="secondary">{record.secondSurnameDb}</Text></div>}
                </div>
            ),
        },
        {
            title: 'Similitud',
            dataIndex: 'similarityScore',
            key: 'similarityScore',
            width: 100,
            render: (score: number) => (
                <Tag color={score >= 0.95 ? 'green' : score >= 0.90 ? 'orange' : 'red'}>
                    {(score * 100).toFixed(1)}%
                </Tag>
            ),
            sorter: (a: PendingDecision, b: PendingDecision) => a.similarityScore - b.similarityScore,
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 120,
            render: (_: any, record: PendingDecision) => (
                <Button
                    type="primary"
                    size="small"
                    onClick={() => handleViewDecision(record)}
                    icon={<InfoCircleOutlined />}
                >
                    Decidir
                </Button>
            ),
        },
    ];

    if (error) {
        return (
            <Alert
                message="Error cargando decisiones pendientes"
                description="No se pudieron cargar las decisiones pendientes. Intenta refrescar la página."
                type="error"
                showIcon
                action={<Button onClick={() => refetch()}>Reintentar</Button>}
            />
        );
    }

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            <Badge count={pendingDecisions?.length || 0} showZero>
                                <CheckOutlined style={{ marginRight: 8 }} />
                                Decisiones Pendientes
                            </Badge>
                        </Title>
                        <Text type="secondary">
                            Registros que requieren revisión manual por similitud de nombres
                        </Text>
                    </div>
                    <Button onClick={() => refetch()} loading={isLoading}>
                        Actualizar
                    </Button>
                </div>
            </Card>

            {isLoading ? (
                <Card>
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Spin size="large" />
                        <div style={{ marginTop: 16 }}>
                            <Text>Cargando decisiones pendientes...</Text>
                        </div>
                    </div>
                </Card>
            ) : !pendingDecisions?.length ? (
                <Card>
                    <Empty
                        description="No hay decisiones pendientes"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </Card>
            ) : (
                <>
                    {pendingDecisions.length > 1 && (
                        <Card size="small">
                            <Title level={5}>Acciones Masivas</Title>
                            <Space>
                                <Button
                                    icon={<LinkOutlined />}
                                    onClick={() => handleBulkProcess('link')}
                                    loading={processDecisionMutation.isPending}
                                >
                                    Vincular Todas
                                </Button>
                                <Button
                                    icon={<UserAddOutlined />}
                                    onClick={() => handleBulkProcess('create_new')}
                                    loading={processDecisionMutation.isPending}
                                >
                                    Crear Nuevas Todas
                                </Button>
                                <Button
                                    icon={<CloseOutlined />}
                                    onClick={() => handleBulkProcess('skip')}
                                    loading={processDecisionMutation.isPending}
                                >
                                    Omitir Todas
                                </Button>
                            </Space>
                            <Divider />
                        </Card>
                    )}

                    <Card>
                        <Table
                            columns={columns}
                            dataSource={pendingDecisions}
                            rowKey="id"
                            pagination={{
                                pageSize: 10,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) => 
                                    `${range[0]}-${range[1]} de ${total} decisiones`,
                            }}
                            scroll={{ x: 800 }}
                        />
                    </Card>
                </>
            )}

            <DecisionModal
                decision={selectedDecision}
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedDecision(null);
                }}
                onProcess={handleProcessDecision}
                loading={processDecisionMutation.isPending}
            />
        </Space>
    );
};