import React, { useState, useEffect } from 'react';
import {
    Card,
    Upload,
    Button,
    Progress,
    Typography,
    Alert,
    Space,
    Statistic,
    Row,
    Col,
    Spin,
    App,
    Descriptions,
    Tag,
    Divider
} from 'antd';
import {
    UploadOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    CloseCircleOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useImportUpload } from '../../hooks/api/import-sage/useImportUpload';
import { useJobStatus } from '../../hooks/api/import-sage/useJobStatus';
import { ImportSummary, JobStatus } from '../../types/import.types';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface ImportCSVComponentProps {
    onImportComplete?: (summary: ImportSummary) => void;
    onJobUpdate?: (status: JobStatus) => void;
}

export const ImportCSVComponent: React.FC<ImportCSVComponentProps> = ({
    onImportComplete,
    onJobUpdate
}) => {
    const { message } = App.useApp();
    
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

    const uploadMutation = useImportUpload();
    const {
        data: jobStatus,
        isLoading: isStatusLoading,
        error: _statusError,
        refetch: refetchStatus
    } = useJobStatus(currentJobId, {
        enabled: !!currentJobId && isPolling,
        refetchInterval: isPolling ? 2000 : false // Poll cada 2 segundos
    });

    // Efecto para manejar el estado del trabajo
    useEffect(() => {
        if (jobStatus) {
            onJobUpdate?.(jobStatus);

            // Si el trabajo está completado o falló, detener el polling
            if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
                setIsPolling(false);
                
                if (jobStatus.status === 'completed' && jobStatus.resultSummary) {
                    setImportSummary(jobStatus.resultSummary);
                    onImportComplete?.(jobStatus.resultSummary);
                    message.success('Importación completada exitosamente');
                } else if (jobStatus.status === 'failed') {
                    message.error(`Error en la importación: ${jobStatus.errorMessage || 'Error desconocido'}`);
                }
            }
        }
    }, [jobStatus, onImportComplete, onJobUpdate]);

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        accept: '.csv',
        beforeUpload: (file) => {
            const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
            if (!isCSV) {
                message.error('Solo se permiten archivos CSV');
                return false;
            }

            const isLt50M = file.size / 1024 / 1024 < 50;
            if (!isLt50M) {
                message.error('El archivo debe ser menor a 50MB');
                return false;
            }

            return true;
        },
        customRequest: async ({ file, onSuccess, onError }) => {
            try {
                const formData = new FormData();
                formData.append('file', file as File);

                const result = await uploadMutation.mutateAsync(formData);
                setCurrentJobId(result.jobId);
                setIsPolling(true);
                setImportSummary(null);
                
                message.success('Archivo subido. Iniciando importación...');
                onSuccess?.(result);
            } catch (error: any) {
                message.error(`Error subiendo archivo: ${error?.message || 'Error desconocido'}`);
                onError?.(error);
            }
        },
        showUploadList: false
    };

    const handleRetry = () => {
        if (currentJobId) {
            setIsPolling(true);
            refetchStatus();
        }
    };

    const handleReset = () => {
        setCurrentJobId(null);
        setIsPolling(false);
        setImportSummary(null);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'success';
            case 'failed':
                return 'error';
            case 'processing':
                return 'processing';
            case 'pending':
                return 'default';
            default:
                return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'failed':
                return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
            case 'processing':
                return <Spin size="small" />;
            case 'pending':
                return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
            default:
                return null;
        }
    };

    const renderUploadArea = () => (
        <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                    <Title level={3}>Importar Usuarios desde SAGE</Title>
                    <Text type="secondary">
                        Sube un archivo CSV con los datos de empleados para importar usuarios, empresas y centros de trabajo.
                    </Text>
                </div>

                <Dragger {...uploadProps} disabled={uploadMutation.isPending || isPolling}>
                    <p className="ant-upload-drag-icon">
                        <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">
                        Haz clic o arrastra el archivo CSV aquí para subirlo
                    </p>
                    <p className="ant-upload-hint">
                        Solo archivos CSV. Tamaño máximo: 50MB
                    </p>
                </Dragger>

                <Alert
                    message="Formato del archivo"
                    description="El archivo debe tener separador ';' (punto y coma) y contener las columnas requeridas de SAGE."
                    type="info"
                    showIcon
                />
            </Space>
        </Card>
    );

    const renderProgress = () => {
        if (!jobStatus) return null;

        return (
            <Card>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>
                            {getStatusIcon(jobStatus.status)} Progreso de Importación
                        </Title>
                        <Tag color={getStatusColor(jobStatus.status)} style={{ fontSize: '14px', padding: '4px 12px' }}>
                            {jobStatus.status.toUpperCase()}
                        </Tag>
                    </div>

                    <Progress
                        percent={jobStatus.progress}
                        status={jobStatus.status === 'failed' ? 'exception' : jobStatus.status === 'completed' ? 'success' : 'active'}
                        strokeColor={{
                            '0%': '#108ee9',
                            '100%': '#87d068',
                        }}
                    />

                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic
                                title="Filas Procesadas"
                                value={jobStatus.processedRows}
                                suffix={`/ ${jobStatus.totalRows}`}
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Progreso"
                                value={jobStatus.progress}
                                suffix="%"
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="ID de Trabajo"
                                value={jobStatus.jobId}
                                valueStyle={{ fontSize: '12px' }}
                            />
                        </Col>
                    </Row>

                    {jobStatus.errorMessage && (
                        <Alert
                            message="Error en la importación"
                            description={jobStatus.errorMessage}
                            type="error"
                            showIcon
                        />
                    )}

                    <Space>
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={handleRetry}
                            loading={isStatusLoading}
                        >
                            Actualizar Estado
                        </Button>
                        {(jobStatus.status === 'completed' || jobStatus.status === 'failed') && (
                            <Button onClick={handleReset}>
                                Nueva Importación
                            </Button>
                        )}
                    </Space>
                </Space>
            </Card>
        );
    };

    const renderSummary = () => {
        if (!importSummary) return null;

        return (
            <Card>
                <Title level={4}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    Resumen de Importación
                </Title>

                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Usuarios Nuevos"
                                value={importSummary.new_users}
                                valueStyle={{ color: '#3f8600' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Usuarios Actualizados"
                                value={importSummary.updated_users}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Nuevas Empresas"
                                value={importSummary.new_companies}
                                valueStyle={{ color: '#722ed1' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Nuevos Centros"
                                value={importSummary.new_centers}
                                valueStyle={{ color: '#fa8c16' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Asociaciones Creadas"
                                value={importSummary.new_associations}
                                valueStyle={{ color: '#13c2c2' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card size="small">
                            <Statistic
                                title="Decisiones Pendientes"
                                value={importSummary.decisions_pending}
                                valueStyle={{ color: importSummary.decisions_pending > 0 ? '#fa541c' : '#3f8600' }}
                            />
                        </Card>
                    </Col>
                </Row>

                <Divider />

                <Descriptions title="Detalles" column={2} size="small">
                    <Descriptions.Item label="Total de Filas">{importSummary.total_rows}</Descriptions.Item>
                    <Descriptions.Item label="Filas Procesadas">{importSummary.processed_rows}</Descriptions.Item>
                    <Descriptions.Item label="Errores">{importSummary.errors}</Descriptions.Item>
                    <Descriptions.Item label="Tasa de Éxito">
                        {importSummary.total_rows > 0 
                            ? `${((importSummary.processed_rows - importSummary.errors) / importSummary.total_rows * 100).toFixed(1)}%`
                            : '0%'
                        }
                    </Descriptions.Item>
                </Descriptions>

                {importSummary.decisions_pending > 0 && (
                    <Alert
                        message="Decisiones Pendientes"
                        description={`Hay ${importSummary.decisions_pending} registros que requieren revisión manual debido a similitudes en nombres. Ve a la sección de Decisiones Pendientes para procesarlos.`}
                        type="warning"
                        showIcon
                        style={{ marginTop: 16 }}
                    />
                )}

                {importSummary.errors > 0 && (
                    <Alert
                        message="Errores en la Importación"
                        description={`Se encontraron ${importSummary.errors} errores durante el procesamiento. Revisa los logs para más detalles.`}
                        type="error"
                        showIcon
                        style={{ marginTop: 16 }}
                    />
                )}
            </Card>
        );
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {!currentJobId ? renderUploadArea() : renderProgress()}
            {importSummary && renderSummary()}
        </Space>
    );
};