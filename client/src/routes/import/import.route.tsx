import React from 'react';
import { Card, Tabs, Typography, Space } from 'antd';
import { 
    UploadOutlined, 
    CheckSquareOutlined, 
    CheckCircleOutlined,
    HistoryOutlined 
} from '@ant-design/icons';
import { 
    ImportCSVComponent,
    PendingDecisionsComponent,
    ProcessedDecisionsComponent,
    ImportJobsHistoryComponent
} from '../../components/import';
import { AuthzHide } from '../../components/permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';

const { Title } = Typography;

export const ImportPage: React.FC = () => {
    const tabItems = [
        {
            key: 'upload',
            label: (
                <span>
                    <UploadOutlined />
                    Subir CSV
                </span>
            ),
            children: <ImportCSVComponent />
        },
        {
            key: 'decisions',
            label: (
                <span>
                    <CheckSquareOutlined />
                    Decisiones Pendientes
                </span>
            ),
            children: <PendingDecisionsComponent />
        },
        {
            key: 'processed',
            label: (
                <span>
                    <CheckCircleOutlined />
                    Decisiones Tomadas
                </span>
            ),
            children: <ProcessedDecisionsComponent />
        },
        {
            key: 'history',
            label: (
                <span>
                    <HistoryOutlined />
                    Historial
                </span>
            ),
            children: <ImportJobsHistoryComponent />
        }
    ];

    return (
        <AuthzHide roles={[Role.ADMIN]}>
            <div style={{ padding: '24px' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                    <Title level={2}>
                        <UploadOutlined style={{ marginRight: 8 }} />
                        Gestión de Importaciones
                    </Title>
                    <p style={{ color: '#666', marginBottom: 0 }}>
                        Importa usuarios, empresas y centros de trabajo desde archivos CSV de SAGE.
                        Gestiona decisiones manuales y revisa el historial de importaciones.
                    </p>
                </Card>

                <Card>
                    <Tabs 
                        defaultActiveKey="upload" 
                        size="large"
                        items={tabItems}
                    />
                </Card>
            </Space>
            </div>
        </AuthzHide>
    );
};