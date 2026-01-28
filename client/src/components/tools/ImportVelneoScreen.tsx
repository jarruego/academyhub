import { useState } from 'react';
import { Upload, Button, Card, Typography, App } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuthInfo } from '../../providers/auth/auth.context';

const { Title, Paragraph } = Typography;


export default function ImportVelneoScreen() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const { authInfo: { token } } = useAuthInfo();
  const [phase, setPhase] = useState<'users'|'companies'|'associate'|'courses'|'groups'>('companies');

  const handleUpload = async (options: any) => {
    // require the user to select a phase (default is 'companies')
    if (!phase) {
      message.warning('Selecciona una fase antes de subir el CSV.');
      options.onError && options.onError(new Error('phase_not_selected'));
      return;
    }
    setLoading(true);
    const formData = new FormData();
    const file = options.file instanceof File ? options.file : options.file.originFileObj;
    formData.append('file', file);
    formData.append('phase', phase);
    try {
  const res = await axios.post('/api/import-velneo/upload-csv', formData, {
        headers: {
          'Authorization': `Bearer ${token}`
          // No agregar Content-Type, el browser lo maneja automáticamente para FormData
        },
      });
      message.success(res.data.message || 'Importación iniciada correctamente');
      options.onSuccess && options.onSuccess(res.data, file);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Error desconocido al subir el archivo';
      message.error(`Error: ${errorMsg}`);
      console.error('Upload error:', err?.response || err);
      options.onError && options.onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ maxWidth: 600, margin: '40px auto' }}>
      <Title level={3}>Importar datos Velneo</Title>
      <Paragraph>Sube un archivo CSV con los datos de usuarios, cursos y grupos. El proceso es asíncrono y recibirás un mensaje al finalizar.</Paragraph>
      <div style={{ marginBottom: 12 }}>
        <Button type={phase === 'companies' ? 'primary' : 'default'} onClick={() => setPhase('companies')} style={{ marginRight: 8 }}>Empresas/Centros</Button>
  <Button type={phase === 'users' ? 'primary' : 'default'} onClick={() => setPhase('users')} style={{ marginRight: 8 }}>Usuarios</Button>
  <Button type={phase === 'associate' ? 'primary' : 'default'} onClick={() => setPhase('associate')} style={{ marginRight: 8 }}>Asociar Usuarios</Button>
  <Button type={phase === 'courses' ? 'primary' : 'default'} onClick={() => setPhase('courses')} style={{ marginRight: 8 }}>Cursos</Button>
        <Button type={phase === 'groups' ? 'primary' : 'default'} onClick={() => setPhase('groups')} style={{ marginRight: 8 }}>Grupos</Button>
      </div>
      <Upload
        customRequest={handleUpload}
        accept=".csv"
        showUploadList={false}
          disabled={loading}
      >
        <Button icon={<UploadOutlined />} loading={loading} type="primary">
          Subir CSV
        </Button>
      </Upload>
    </Card>
  );
}
