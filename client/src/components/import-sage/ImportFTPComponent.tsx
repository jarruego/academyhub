import React, { useEffect, useMemo, useState } from 'react';
import { Card, Space, Typography, Button, Alert, Input, Tag, Progress, Spin, Divider, Statistic, Row, Col, App } from 'antd';
import { CloudDownloadOutlined, ReloadOutlined, StopOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, DownloadOutlined, WifiOutlined } from '@ant-design/icons';
import { useImportUploadFtp } from '../../hooks/api/import-sage/useImportUploadFtp';
import { useJobStatus } from '../../hooks/api/import-sage/useJobStatus';
import { useSftpConnection } from '../../hooks/api/import-sage/useSftpConnection';
import { useSftpFileDownload } from '../../hooks/api/import-sage/useSftpFileDownload';
import { ImportSummary } from '../../types/import.types';

const { Title, Text, Paragraph } = Typography;

export const ImportFTPComponent: React.FC = () => {
  const { message } = App.useApp();
  const [remotePath, setRemotePath] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const ftpMutation = useImportUploadFtp();
  const {
    data: jobStatus,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useJobStatus(currentJobId, {
    enabled: !!currentJobId && isPolling,
    refetchInterval: isPolling ? 2000 : false,
  });

  // Verificar conexión SFTP
  const {
    data: connectionStatus,
    isLoading: isConnectionLoading,
    refetch: refetchConnection,
  } = useSftpConnection();

  // Descargar archivo
  const { downloadFile } = useSftpFileDownload();

  useEffect(() => {
    if (!jobStatus) return;

    if (jobStatus.status === 'completed') {
      setIsPolling(false);
      if (jobStatus.resultSummary) setImportSummary(jobStatus.resultSummary);
      message.success('Importación desde FTP completada');
    }

    if (jobStatus.status === 'failed') {
      setIsPolling(false);
      message.error(jobStatus.errorMessage || 'La importación desde FTP falló');
    }
  }, [jobStatus, message]);

  const handleStart = async () => {
    try {
      const result = await ftpMutation.mutateAsync({ path: remotePath || undefined });
      setCurrentJobId(result.jobId);
      setIsPolling(true);
      setImportSummary(null);
      message.success('Importación iniciada desde FTP');
    } catch (error: any) {
      message.error(error?.message || 'Error iniciando importación desde FTP');
    }
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

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadFile();
      message.success('Archivo descargado exitosamente');
    } catch (error: any) {
      message.error(error?.message || 'Error descargando archivo del FTP');
    } finally {
      setIsDownloading(false);
    }
  };

  const statusTag = useMemo(() => {
    switch (jobStatus?.status) {
      case 'completed':
        return <Tag color="green" icon={<CheckCircleOutlined />}>Completado</Tag>;
      case 'failed':
        return <Tag color="red" icon={<CloseCircleOutlined />}>Fallido</Tag>;
      case 'processing':
        return <Tag color="blue" icon={<Spin size="small" />}>Procesando</Tag>;
      case 'pending':
        return <Tag color="default" icon={<ExclamationCircleOutlined />}>Pendiente</Tag>;
      default:
        return null;
    }
  }, [jobStatus]);

  const renderForm = () => (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>Importar desde FTP</Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Usa las credenciales configuradas en el servidor (SFTP_SAGE_*). Opcionalmente puedes indicar una ruta
            remota distinta para este lanzamiento.
          </Paragraph>
        </div>

        {/* Estado de conexión SFTP */}
        <Card
          size="small"
          style={{
            backgroundColor: connectionStatus?.isConnected ? '#f6ffed' : '#fff2e8',
            borderColor: connectionStatus?.isConnected ? '#b7eb8f' : '#ffbb96',
          }}
        >
          <Space>
            <WifiOutlined
              style={{
                color: connectionStatus?.isConnected ? '#52c41a' : '#ff7a45',
                fontSize: 18,
              }}
            />
            <div>
              <Text strong>
                {connectionStatus?.isConnected ? 'Conectado' : 'Desconectado'}
              </Text>
              <Paragraph style={{ margin: 0 }} type="secondary">
                {connectionStatus?.message}
              </Paragraph>
            </div>
            <Button
              type="text"
              size="small"
              loading={isConnectionLoading}
              onClick={() => refetchConnection()}
              style={{ marginLeft: 'auto' }}
            >
              Actualizar
            </Button>
          </Space>
        </Card>

        <Input
          placeholder="Ruta remota opcional (se usará SFTP_SAGE_PATH si se deja vacío)"
          value={remotePath}
          onChange={(e) => setRemotePath(e.target.value)}
          disabled={ftpMutation.isPending || isPolling}
        />

        <Space>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={ftpMutation.isPending}
            onClick={handleStart}
            disabled={isPolling || !connectionStatus?.isConnected}
          >
            Lanzar importación desde FTP
          </Button>
          {connectionStatus?.isConnected && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              loading={isDownloading}
            >
              Descargar archivo
            </Button>
          )}
          {currentJobId && (
            <Button icon={<ReloadOutlined />} onClick={handleRetry} disabled={isStatusLoading || !isPolling}>
              Reintentar estado
            </Button>
          )}
          {currentJobId && (
            <Button icon={<StopOutlined />} onClick={handleReset}>
              Reset
            </Button>
          )}
        </Space>

        {ftpMutation.isPending && (
          <Alert type="info" showIcon message="Conectando al FTP y arrancando importación..." />
        )}
      </Space>
    </Card>
  );

  const renderProgress = () => {
    if (!jobStatus) return null;

    const percent = jobStatus.totalRows > 0 ? Math.round((jobStatus.processedRows / jobStatus.totalRows) * 100) : 0;
    const progressStatus: 'success' | 'exception' | 'active' | 'normal' =
      jobStatus.status === 'failed' ? 'exception' : jobStatus.status === 'completed' ? 'success' : 'active';

    return (
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space align="center" size="middle">
            <Text strong>Estado:</Text>
            {statusTag}
            <Text type="secondary">Job ID: {jobStatus.jobId}</Text>
          </Space>
          <Progress percent={percent} status={progressStatus} />
          <Space>
            <Text>Total filas: {jobStatus.totalRows}</Text>
            <Text>Procesadas: {jobStatus.processedRows}</Text>
          </Space>
          {jobStatus.errorMessage && (
            <Alert type="error" showIcon message="Error" description={jobStatus.errorMessage} />
          )}
        </Space>
      </Card>
    );
  };

  const renderSummary = () => {
    if (!importSummary) return null;

    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={4} style={{ marginBottom: 0 }}>Resumen de importación</Title>

          <Row gutter={16}>
            <Col span={6}><Statistic title="Total filas" value={importSummary.total_rows} /></Col>
            <Col span={6}><Statistic title="Nuevos usuarios" value={importSummary.new_users} /></Col>
            <Col span={6}><Statistic title="Usuarios actualizados" value={importSummary.updated_users} /></Col>
            <Col span={6}><Statistic title="Decisiones pendientes" value={importSummary.decisions_pending} valueStyle={{ color: importSummary.decisions_pending > 0 ? '#fa8c16' : undefined }} /></Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}><Statistic title="Empresas nuevas" value={importSummary.new_companies} /></Col>
            <Col span={6}><Statistic title="Centros nuevos" value={importSummary.new_centers} /></Col>
            <Col span={6}><Statistic title="Asociaciones nuevas" value={importSummary.new_associations} /></Col>
            <Col span={6}><Statistic title="Errores" value={importSummary.errors} valueStyle={{ color: importSummary.errors > 0 ? '#ff4d4f' : undefined }} /></Col>
          </Row>

          <Divider />

          {importSummary.decisions_pending > 0 && (
            <Alert
              message="Decisiones pendientes"
              description={`Hay ${importSummary.decisions_pending} registros que requieren revisión manual en la pestaña de Decisiones.`}
              type="warning"
              showIcon
            />
          )}

          {importSummary.errors > 0 && (
            <Alert
              message="Errores en la importación"
              description={`Se encontraron ${importSummary.errors} errores durante el procesamiento.`}
              type="error"
              showIcon
            />
          )}
        </Space>
      </Card>
    );
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {renderForm()}
      {isPolling && renderProgress()}
      {importSummary && renderSummary()}
    </Space>
  );
};
