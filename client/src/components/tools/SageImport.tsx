import React from 'react';
import { Card, Tabs, Space } from 'antd';
import {
    UploadOutlined,
    CheckSquareOutlined,
    CheckCircleOutlined,
    HistoryOutlined,
    CloudDownloadOutlined,
    WarningOutlined
} from '@ant-design/icons';
import {
    ImportCSVComponent,
    ImportFTPComponent,
    PendingDecisionsComponent,
    ProcessedDecisionsComponent,
    ImportJobsHistoryComponent,
    FailedUsersView
} from '../import-sage';
import { AuthzHide } from '../permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';
import { PageHeader } from '../common/PageHeader';

const SageImport: React.FC = () => {
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
            key: 'ftp',
            label: (
                <span>
                    <CloudDownloadOutlined />
                    Importar desde FTP
                </span>
            ),
            children: <ImportFTPComponent />
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
            key: 'failed',
            label: (
                <span>
                    <WarningOutlined />
                    Usuarios Fallidos
                </span>
            ),
            children: <FailedUsersView />
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
            <div>
            <PageHeader
                title="Importación CSV SAGE"
                subtitle="Importa usuarios, empresas y centros de trabajo desde archivos CSV de SAGE. Gestiona decisiones manuales y revisa el historial de importaciones."
            />
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
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

export default SageImport;