import { useState, useEffect } from 'react';
import { Form, Input, Button, Upload, Image, Row, Col, message, Modal, Typography, Card } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { InboxOutlined } from '@ant-design/icons';
import { useRole } from '../../utils/permissions/use-role';
import { resolveAssetUrl } from '../../utils/resolve-asset-url.util';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useUpsertOrganizationMutation } from '../../hooks/api/organization/use-upsert-organization.mutation';
import { useUploadOrganizationAsset } from '../../hooks/api/organization/use-upload-organization-asset.mutation';

export default function OrganizationSettingsPage() {
  const role = useRole();
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const { data, isLoading } = useOrganizationSettingsQuery();
  const saveMutation = useUpsertOrganizationMutation();
  const uploadMutation = useUploadOrganizationAsset();
  // Support different react-query versions: safe loading flag for the save button
  function hasIsLoading(x: unknown): x is { isLoading: boolean } {
    return typeof x === 'object' && x !== null && 'isLoading' in x && typeof (x as any).isLoading === 'boolean';
  }

  const statusValue = (saveMutation as unknown as { status?: unknown }).status;
  const saveLoading = hasIsLoading(saveMutation)
    ? saveMutation.isLoading
    : (typeof statusValue === 'string' && (statusValue === 'pending' || statusValue === 'loading'));

  const uploadRequest = async (options: UploadRequestOption, type: 'logo' | 'signature') => {
    const { file, onSuccess, onError } = options;
    setLoadingUpload(true);
    try {
      await uploadMutation.mutateAsync({ file: file as Blob, type });
      message.success('Fichero subido');
      onSuccess && onSuccess(null, file as any);
    } catch (err) {
      console.error(err);
      message.error('Error subiendo fichero');
      onError && onError(err as Error);
    } finally {
      setLoadingUpload(false);
    }
  };

  const [form] = Form.useForm();
  const [jsonText, setJsonText] = useState<string>('');

  // Example default settings to show when there are no settings yet
  const exampleSettings = {
    site_name: "Mi Centro",
    contact: { name: "Contacto", email: "contacto@centro.test", phone: "" },
    moodle: { url: "https://moodle.example.com" },
    // Plugin flags: set installed Moodle plugins to false by default
    plugins: {
      // iTopTraining (gestión de grupos, fundae, scorms...)
      itop_training: false,
      // Informes Configurables
      configurable_reports: false,
      // Certificados
      certificates: false,
      // Barra de Progreso
      progress_bar: false,
    }
  };

  // Initialize jsonValue when data arrives or on first render
  useEffect(() => {
    if (data) {
      const v = data.settings ?? {};
      setJsonText(JSON.stringify(v, null, 2));
    } else {
      setJsonText(JSON.stringify(exampleSettings, null, 2));
    }
  }, [data]);

  const handleSave = () => {
    if (!jsonText) return message.error('Nada para guardar');
    try {
  const parsed = JSON.parse(jsonText);
  saveMutation.mutate({ settings: parsed });
    } catch (err) {
      message.error('JSON inválido: ' + (err as Error).message);
    }
  };

  const openTokenModal = () => {
    setTokenValue('');
    setTokenModalVisible(true);
  };

  const handleTokenSave = async () => {
    if (!tokenValue) return message.warning('Introduce el token');
    // Send plain token to backend; backend will encrypt
    saveMutation.mutate({ encrypted_secrets: { moodle_token_plain: tokenValue } });
    setTokenModalVisible(false);
  };

  const admin = role?.toLowerCase() === 'admin';

  // use shared resolveAssetUrl util (imported above)

  return (
    <div>
      <h2 style={{ margin: 16 }}>Ajustes de la organización</h2>
      {isLoading && <Typography.Text type="secondary" style={{ marginLeft: 16 }}>Cargando ajustes...</Typography.Text>}

      {!admin && (
        <div style={{ margin: 16 }}>
          <p>No tienes permisos de administrador para editar estos ajustes.</p>
        </div>
      )}

      <Row gutter={16} style={{ padding: 16 }}>
        <Col span={12}>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item label="Settings (JSON)">
              {jsonText ? (
                <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 4, maxHeight: 420, overflow: 'auto' }}>
                  <Input.TextArea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    rows={20}
                    disabled={!admin}
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </div>
              ) : (
                <div>Loading editor...</div>
              )}
            </Form.Item>

            <Form.Item>
              <Button type="primary" onClick={handleSave} loading={saveLoading} disabled={!admin}>
                Guardar ajustes
              </Button>
              <Button style={{ marginLeft: 8 }} onClick={openTokenModal} disabled={!admin}>
                {data && data?.version ? 'Cambiar token de Moodle' : 'Configurar token de Moodle'}
              </Button>
            </Form.Item>
          </Form>
        </Col>

        <Col span={12}>
          <div style={{ marginBottom: 16 }}>
            <h3>Logo</h3>
            {data?.logo_path ? <Image src={resolveAssetUrl(data.logo_path)} alt="logo" width={200} /> : <div>No hay logo configurado</div>}
            <Upload customRequest={(opts) => uploadRequest(opts, 'logo')} showUploadList={false} disabled={!admin}>
              <Button icon={<InboxOutlined />} style={{ marginTop: 8 }} disabled={!admin} loading={loadingUpload}>Subir logo</Button>
            </Upload>
          </div>

          <div>
            <h3>Firma del diploma</h3>
            {data?.signature_path ? <Image src={resolveAssetUrl(data.signature_path)} alt="signature" width={200} /> : <div>No hay firma configurada</div>}
            <Upload customRequest={(opts) => uploadRequest(opts, 'signature')} showUploadList={false} disabled={!admin}>
              <Button icon={<InboxOutlined />} style={{ marginTop: 8 }} disabled={!admin} loading={loadingUpload}>Subir firma</Button>
            </Upload>
          </div>
        </Col>
      </Row>

      <Modal title="Configurar token de Moodle" visible={tokenModalVisible} onOk={handleTokenSave} onCancel={() => setTokenModalVisible(false)} okText="Guardar">
        <Form layout="vertical">
          <Form.Item label="Token de Moodle">
            <Input.Password value={tokenValue} onChange={(e) => setTokenValue(e.target.value)} />
          </Form.Item>
          <p>El token se enviará al servidor y se guardará cifrado; no se mostrará en la UI.</p>
        </Form>
      </Modal>
      <Card style={{ margin: 16 }}>
        <Typography.Title level={5}>Instrucciones</Typography.Title>
        <Typography.Paragraph>
          Si no existen ajustes en la base de datos se muestra un JSON de ejemplo para que puedas editarlo. Rellena los campos y pulsa "Guardar ajustes".
          Para configurar el token de Moodle abre "Configurar token de Moodle"; el token se enviará al servidor y se guardará cifrado.
        </Typography.Paragraph>
        <Typography.Paragraph>
          Logo y firma: sube las imágenes en las secciones correspondientes; después de la subida la vista se actualizará automáticamente.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
