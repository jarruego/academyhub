import { useState, useEffect } from 'react';
import { Form, Input, Button, Upload, Image, Row, Col, message, Modal, Typography, Card } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { InboxOutlined } from '@ant-design/icons';
import { useRole } from '../../utils/permissions/use-role';
import { resolveAssetUrl } from '../../utils/resolve-asset-url.util';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useUpsertOrganizationMutation } from '../../hooks/api/organization/use-upsert-organization.mutation';
import { useUploadOrganizationAsset } from '../../hooks/api/organization/use-upload-organization-asset.mutation';
import { useCheckMoodleConnection } from '../../hooks/api/moodle/use-check-moodle.mutation';

export default function OrganizationSettingsPage() {
  const role = useRole();
  // Use message.useMessage() to avoid antd warning about static message consuming dynamic theme/context
  const [messageApi, messageContextHolder] = message.useMessage();
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const { data, isLoading } = useOrganizationSettingsQuery();
  const saveMutation = useUpsertOrganizationMutation();
  const uploadMutation = useUploadOrganizationAsset();
  // Support different react-query versions: safe loading flag for the save button
  function hasIsLoading(x: unknown): x is { isLoading: boolean } {
    if (typeof x === 'object' && x !== null && 'isLoading' in x) {
      const v = (x as Record<string, unknown>)['isLoading'];
      return typeof v === 'boolean';
    }
    return false;
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
      messageApi.success('Fichero subido');
  onSuccess && onSuccess(null, file as File);
    } catch (err) {
      console.error(err);
      messageApi.error('Error subiendo fichero');
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
    // Company identification fields requested: CIF, Razon social and DNI of the responsible person
    company: {
      cif: "A12345678",
      razon_social: "Academia Ejemplo SL",
      direccion: "Calle Falsa 123, 28000 Madrid",
      responsable_nombre: "Juan Pérez",
      responsable_dni: "12345678A",
    },
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
    if (!jsonText) return messageApi.error('Nada para guardar');
    try {
  const parsed: unknown = JSON.parse(jsonText);
  // Basic client-side validation for required company fields to give immediate feedback
  const parsedObj = (typeof parsed === 'object' && parsed !== null) ? parsed as Record<string, unknown> : {};
  const company = (typeof parsedObj['company'] === 'object' && parsedObj['company'] !== null) ? parsedObj['company'] as Record<string, unknown> : null;
  const required = ['cif', 'razon_social', 'direccion', 'responsable_nombre', 'responsable_dni'];
  const missing = required.filter((k) => !company || typeof company[k] !== 'string' || company[k].trim().length === 0);
  if (missing.length > 0) {
    return messageApi.error(`Faltan campos obligatorios en company: ${missing.join(', ')}`);
  }

  // Use mutateAsync so we can catch server validation errors and show them to the user
  (async () => {
  try {
  await saveMutation.mutateAsync({ settings: parsedObj });
      messageApi.success('Ajustes guardados');
    } catch (err: any) {
      // Try to read NestJS error shape (message may be string or array)
      const serverMsg = getServerMessage(err);
      messageApi.error(serverMsg);
    }
  })();
    } catch (err) {
      const msg = (err instanceof Error) ? err.message : String(err);
      messageApi.error('JSON inválido: ' + msg);
    }
  };

  const openTokenModal = () => {
    setTokenValue('');
    setTokenModalVisible(true);
  };

  const checkMoodle = useCheckMoodleConnection();
  const checkStatusValue = (checkMoodle as unknown as { status?: unknown }).status;
  const checkingMoodle = hasIsLoading(checkMoodle)
    ? checkMoodle.isLoading
    : (typeof checkStatusValue === 'string' && (checkStatusValue === 'pending' || checkStatusValue === 'loading'));

  const handleCheckMoodle = async () => {
    try {
      const resp = await checkMoodle.mutateAsync();
      const payload = resp.data;
      if (payload?.success) {
        const info = payload.info;
        let label = '';
        if (info && typeof info === 'object') {
          const asAny = info as Record<string, unknown>;
          label = (asAny.sitefullname as string) || (asAny.site_name as string) || JSON.stringify(info).slice(0, 200);
        } else {
          label = String(info ?? 'Conexión OK');
        }
        messageApi.success(`Conectado a Moodle: ${label}`);
      } else {
        messageApi.error(payload?.message ?? 'No se pudo conectar a Moodle');
      }
    } catch (err) {
      console.error('Moodle check failed', err);
      const serverMsg = getServerMessage(err as unknown);
      messageApi.error(serverMsg || 'Error comprobando conexión a Moodle');
    }
  };

  const handleTokenSave = async () => {
  if (!tokenValue) return messageApi.warning('Introduce el token');
    // Send plain token to backend; backend will encrypt
    try {
      await saveMutation.mutateAsync({ encrypted_secrets: { moodle_token_plain: tokenValue } });
      messageApi.success('Token guardado');
    } catch (err) {
      const serverMsg = getServerMessage(err);
      messageApi.error(serverMsg);
    }
    setTokenModalVisible(false);
  };

  const admin = role?.toLowerCase() === 'admin';

  function getServerMessage(err: unknown): string {
    if (typeof err === 'object' && err !== null) {
      const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
      const msg = e.response?.data?.message ?? e.message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg)) return msg.join('; ');
      return String(msg ?? 'Error en la petición');
    }
    return String(err ?? 'Error en la petición');
  }

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
              {messageContextHolder}
              {jsonText ? (
                <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 4, maxHeight: 420, overflow: 'hidden' }}>
                  <Input.TextArea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    // remove rows and set explicit height so only the textarea scrolls
                    disabled={!admin}
                    style={{ fontFamily: 'monospace', fontSize: 13, height: 420, overflow: 'auto', resize: 'vertical' }}
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
              <Button style={{ marginLeft: 8 }} onClick={handleCheckMoodle} loading={checkingMoodle} disabled={!admin}>
                Comprobar conexión Moodle
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

  <Modal title="Configurar token de Moodle" open={tokenModalVisible} onOk={handleTokenSave} onCancel={() => setTokenModalVisible(false)} okText="Guardar">
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
