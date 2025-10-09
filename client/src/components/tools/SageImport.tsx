import React from 'react';
import { Card, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const SageImport: React.FC = () => {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
        <Title level={2}>Importación CSV SAGE</Title>
        <Paragraph type="secondary" style={{ fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
          Herramienta para importar datos desde archivos CSV generados por SAGE.
        </Paragraph>
        <Paragraph type="secondary" style={{ marginTop: '24px' }}>
          Esta funcionalidad estará disponible próximamente.
        </Paragraph>
      </div>
    </Card>
  );
};

export default SageImport;