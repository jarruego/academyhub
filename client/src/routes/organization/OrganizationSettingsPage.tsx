import { useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, Image, Input, InputNumber, Modal, Row, Select, Switch, Tag, Typography, Upload } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { ApiOutlined, DeleteOutlined, InboxOutlined, KeyOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { Controller, SubmitHandler, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import { useRole } from '../../utils/permissions/use-role';
import { resolveAssetUrl } from '../../utils/resolve-asset-url.util';
import { useOrganizationSettingsQuery } from '../../hooks/api/organization/use-organization-settings.query';
import { useUpsertOrganizationMutation } from '../../hooks/api/organization/use-upsert-organization.mutation';
import { useUploadOrganizationAsset } from '../../hooks/api/organization/use-upload-organization-asset.mutation';
import { useCheckMoodleConnection } from '../../hooks/api/moodle/use-check-moodle.mutation';
import { CIF_SCHEMA } from '../../schemas/cif.schema';
import { DNI_SCHEMA } from '../../schemas/dni.schema';
import type { OrganizationSettingsData, OrganizationSettingsUpsert } from '../../shared/types/organization/organization';

const ORG_SETTINGS_FORM = z.object({
  site_name: z.string(),
  contact: z.object({
    name: z.string(),
    email: z.string().email('El email no es válido').or(z.literal('')),
    phone: z.string(),
  }),
  company: z.object({
    cif: CIF_SCHEMA,
    razon_social: z.string().min(1, 'La razón social es obligatoria'),
    direccion: z.string().min(1, 'La dirección es obligatoria'),
    ciudad: z.string(),
    responsable_nombre: z.string().min(1, 'El nombre del responsable es obligatorio'),
    responsable_dni: DNI_SCHEMA,
  }),
  moodle: z.object({
    url: z.string().refine((v) => !v || /^https?:\/\//i.test(v), 'La URL debe empezar por http:// o https://'),
    customfields: z.array(z.object({
      shortname: z.string().min(1, 'Obligatorio'),
      source: z.string().min(1, 'Obligatorio'),
    })),
  }),
  file_transfer: z.object({
    type: z.enum(['ftp', 'sftp']),
    host: z.string(),
    port: z.number({ invalid_type_error: 'Debe ser un número' }).int('Debe ser un entero').min(1).max(65535),
    user: z.string(),
    password: z.string(),
    path: z.string(),
  }),
  plugins: z.object({
    itop_training: z.boolean(),
    configurable_reports: z.boolean(),
    certificates: z.boolean(),
    progress_bar: z.boolean(),
  }),
});

type OrgSettingsFormValues = z.infer<typeof ORG_SETTINGS_FORM>;

const EMPTY_FORM_VALUES: OrgSettingsFormValues = {
  site_name: '',
  contact: { name: '', email: '', phone: '' },
  company: { cif: '', razon_social: '', direccion: '', ciudad: '', responsable_nombre: '', responsable_dni: '' },
  moodle: { url: '', customfields: [] },
  file_transfer: { type: 'ftp', host: '', port: 21, user: '', password: '', path: '' },
  plugins: { itop_training: false, configurable_reports: false, certificates: false, progress_bar: false },
};

/** El GET devuelve la forma completa normalizada; solo añadimos la contraseña write-only vacía. */
function toFormValues(settings: OrganizationSettingsData): OrgSettingsFormValues {
  return {
    ...settings,
    file_transfer: { ...settings.file_transfer, password: '' },
  };
}

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

export default function OrganizationSettingsPage() {
  const role = useRole();
  const admin = role?.toLowerCase() === 'admin';
  const { message: messageApi } = App.useApp();
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const { data, isLoading } = useOrganizationSettingsQuery();
  const saveMutation = useUpsertOrganizationMutation();
  const uploadMutation = useUploadOrganizationAsset();
  const checkMoodle = useCheckMoodleConnection();

  const { handleSubmit, control, reset, setValue, formState: { errors } } = useForm<OrgSettingsFormValues>({
    resolver: zodResolver(ORG_SETTINGS_FORM),
    defaultValues: EMPTY_FORM_VALUES,
  });
  const customFieldsArray = useFieldArray({ control, name: 'moodle.customfields' });

  useEffect(() => {
    if (data?.settings) reset(toFormValues(data.settings));
  }, [data, reset]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Ajustes Organización';
    return () => { document.title = prev; };
  }, []);

  const submit: SubmitHandler<OrgSettingsFormValues> = async (values) => {
    const { password, ...fileTransfer } = values.file_transfer;
    const settings: OrganizationSettingsUpsert = {
      ...values,
      file_transfer: password ? { ...fileTransfer, password } : fileTransfer,
    };
    try {
      await saveMutation.mutateAsync({ settings });
      messageApi.success('Ajustes guardados');
      setValue('file_transfer.password', '');
    } catch (err) {
      messageApi.error(getServerMessage(err));
    }
  };

  const uploadRequest = async (options: UploadRequestOption, type: 'logo' | 'signature') => {
    const { file, onSuccess, onError } = options;
    setLoadingUpload(true);
    try {
      await uploadMutation.mutateAsync({ file: file as Blob, type });
      messageApi.success('Fichero subido');
      onSuccess?.(null, file as File);
    } catch (err) {
      console.error(err);
      messageApi.error('Error subiendo fichero');
      onError?.(err as Error);
    } finally {
      setLoadingUpload(false);
    }
  };

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
      messageApi.error(getServerMessage(err) || 'Error comprobando conexión a Moodle');
    }
  };

  const handleTokenSave = async () => {
    if (!tokenValue) return messageApi.warning('Introduce el token');
    // Se envía en claro al backend, que lo cifra antes de guardarlo
    try {
      await saveMutation.mutateAsync({ encrypted_secrets: { moodle_token_plain: tokenValue } });
      messageApi.success('Token guardado');
    } catch (err) {
      messageApi.error(getServerMessage(err));
    }
    setTokenModalVisible(false);
  };

  const hasMoodleToken = data?.secrets?.has_moodle_token ?? false;
  const hasFtpPassword = data?.secrets?.has_file_transfer_password ?? false;

  // Acepta unknown porque los errores de useFieldArray no son FieldError puros
  const fieldError = (error?: unknown) => {
    const message = error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
    return {
      help: message || undefined,
      validateStatus: error ? ('error' as const) : undefined,
    };
  };

  return (
    <div>
      <h2 style={{ margin: 16 }}>Ajustes de la organización</h2>
      {isLoading && <Typography.Text type="secondary" style={{ marginLeft: 16 }}>Cargando ajustes...</Typography.Text>}

      {!admin && (
        <Typography.Paragraph type="warning" style={{ margin: 16 }}>
          No tienes permisos de administrador para editar estos ajustes.
        </Typography.Paragraph>
      )}

      <Form layout="vertical" onFinish={handleSubmit(submit)} disabled={!admin} style={{ padding: 16 }}>
        <Card title="General" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item label="Nombre del centro" tooltip="Aparece en informes y cabeceras" {...fieldError(errors.site_name)}>
                <Controller name="site_name" control={control} render={({ field }) => <Input id="site_name" autoComplete="organization" {...field} />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item label="Persona de contacto" {...fieldError(errors.contact?.name)}>
                <Controller name="contact.name" control={control} render={({ field }) => <Input id="contact_name" autoComplete="name" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Email de contacto" {...fieldError(errors.contact?.email)}>
                <Controller name="contact.email" control={control} render={({ field }) => <Input id="contact_email" autoComplete="email" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Teléfono de contacto" {...fieldError(errors.contact?.phone)}>
                <Controller name="contact.phone" control={control} render={({ field }) => <Input id="contact_phone" autoComplete="tel" {...field} />} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Datos fiscales" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            Se usan en los informes SEPE/FUNDAE. Todos los campos son obligatorios salvo la ciudad.
          </Typography.Paragraph>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item label="CIF" required {...fieldError(errors.company?.cif)}>
                <Controller name="company.cif" control={control} render={({ field }) => <Input id="company_cif" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item label="Razón social" required {...fieldError(errors.company?.razon_social)}>
                <Controller name="company.razon_social" control={control} render={({ field }) => <Input id="company_razon_social" {...field} />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={16}>
              <Form.Item label="Dirección" required {...fieldError(errors.company?.direccion)}>
                <Controller name="company.direccion" control={control} render={({ field }) => <Input id="company_direccion" autoComplete="street-address" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Ciudad" {...fieldError(errors.company?.ciudad)}>
                <Controller name="company.ciudad" control={control} render={({ field }) => <Input id="company_ciudad" {...field} />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={16}>
              <Form.Item label="Nombre del responsable" required {...fieldError(errors.company?.responsable_nombre)}>
                <Controller name="company.responsable_nombre" control={control} render={({ field }) => <Input id="company_responsable_nombre" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="DNI del responsable" required {...fieldError(errors.company?.responsable_dni)}>
                <Controller name="company.responsable_dni" control={control} render={({ field }) => <Input id="company_responsable_dni" {...field} />} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          title="Moodle"
          style={{ marginBottom: 16 }}
          extra={hasMoodleToken ? <Tag color="green">Token configurado</Tag> : <Tag>Sin token</Tag>}
        >
          <Row gutter={[16, 0]}>
            <Col xs={24} md={16}>
              <Form.Item label="URL de Moodle" {...fieldError(errors.moodle?.url)}>
                <Controller name="moodle.url" control={control} render={({ field }) => <Input id="moodle_url" placeholder="https://moodle.example.com" {...field} />} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Custom fields sincronizados" tooltip="Campos personalizados de Moodle rellenados desde AcademyHub al crear/actualizar usuarios">
            <>
              {customFieldsArray.fields.map((item, index) => (
                <Row gutter={[16, 0]} key={item.id} align="top">
                  <Col xs={10} md={8}>
                    <Form.Item {...fieldError(errors.moodle?.customfields?.[index]?.shortname)} style={{ marginBottom: 8 }}>
                      <Controller name={`moodle.customfields.${index}.shortname`} control={control} render={({ field }) => <Input placeholder="shortname en Moodle (p. ej. DNI)" {...field} />} />
                    </Form.Item>
                  </Col>
                  <Col xs={10} md={8}>
                    <Form.Item {...fieldError(errors.moodle?.customfields?.[index]?.source)} style={{ marginBottom: 8 }}>
                      <Controller name={`moodle.customfields.${index}.source`} control={control} render={({ field }) => <Input placeholder="campo origen (p. ej. dni)" {...field} />} />
                    </Form.Item>
                  </Col>
                  <Col xs={4} md={2}>
                    <Button icon={<DeleteOutlined />} aria-label="Eliminar custom field" onClick={() => customFieldsArray.remove(index)} />
                  </Col>
                </Row>
              ))}
              <Button icon={<PlusOutlined />} onClick={() => customFieldsArray.append({ shortname: '', source: '' })}>
                Añadir custom field
              </Button>
            </>
          </Form.Item>

          <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
            <Button icon={<KeyOutlined />} onClick={() => { setTokenValue(''); setTokenModalVisible(true); }}>
              {hasMoodleToken ? 'Cambiar token de Moodle' : 'Configurar token de Moodle'}
            </Button>
            <Button icon={<ApiOutlined />} onClick={handleCheckMoodle} loading={checkMoodle.isPending}>
              Comprobar conexión Moodle
            </Button>
          </div>
        </Card>

        <Card title="Importación SAGE (FTP/SFTP)" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            Conexión que usa la importación automática para descargar el fichero de SAGE. El fichero puede ser un CSV o un comprimido .zip/.7z que lo contenga.
          </Typography.Paragraph>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={4}>
              <Form.Item label="Tipo" {...fieldError(errors.file_transfer?.type)}>
                <Controller name="file_transfer.type" control={control} render={({ field }) => (
                  <Select
                    id="file_transfer_type"
                    style={{ width: '100%' }}
                    options={[{ value: 'ftp', label: 'FTP' }, { value: 'sftp', label: 'SFTP' }]}
                    {...field}
                  />
                )} />
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item label="Servidor (host)" {...fieldError(errors.file_transfer?.host)}>
                <Controller name="file_transfer.host" control={control} render={({ field }) => <Input id="file_transfer_host" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Puerto" {...fieldError(errors.file_transfer?.port)}>
                <Controller name="file_transfer.port" control={control} render={({ field }) => (
                  <InputNumber id="file_transfer_port" style={{ width: '100%' }} min={1} max={65535} {...field} onChange={(v) => field.onChange(v ?? undefined)} />
                )} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item label="Usuario" {...fieldError(errors.file_transfer?.user)}>
                <Controller name="file_transfer.user" control={control} render={({ field }) => <Input id="file_transfer_user" autoComplete="off" {...field} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="Contraseña"
                tooltip="Se guarda cifrada y nunca se muestra. Déjala en blanco para conservar la actual."
                {...fieldError(errors.file_transfer?.password)}
              >
                <Controller name="file_transfer.password" control={control} render={({ field }) => (
                  <Input.Password
                    id="file_transfer_password"
                    autoComplete="new-password"
                    placeholder={hasFtpPassword ? '•••••• (guardada)' : 'Sin contraseña guardada'}
                    {...field}
                  />
                )} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Ruta del fichero" {...fieldError(errors.file_transfer?.path)}>
                <Controller name="file_transfer.path" control={control} render={({ field }) => <Input id="file_transfer_path" placeholder="/datos.7z" {...field} />} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Plugins de Moodle" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary">
            Indica qué plugins tienes instalados en tu Moodle.
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item style={{ marginBottom: 8 }}>
                <Controller name="plugins.itop_training" control={control} render={({ field }) => (
                  <span>
                    <Switch id="plugins_itop_training" checked={field.value} onChange={field.onChange} />{' '}
                    <Typography.Text strong>iTopTraining</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Sincroniza el tiempo dedicado de los alumnos y usa los endpoints del plugin al crear usuarios y grupos en Moodle.
                    </Typography.Paragraph>
                  </span>
                )} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item style={{ marginBottom: 8 }}>
                <Controller name="plugins.certificates" control={control} render={({ field }) => (
                  <span>
                    <Switch id="plugins_certificates" checked={field.value} onChange={field.onChange} />{' '}
                    <Typography.Text strong>Certificados</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Habilita la descarga de certificados de Moodle desde la ficha del usuario.
                    </Typography.Paragraph>
                  </span>
                )} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item style={{ marginBottom: 8 }}>
                <Controller name="plugins.configurable_reports" control={control} render={({ field }) => (
                  <span>
                    <Switch id="plugins_configurable_reports" checked={field.value} onChange={field.onChange} />{' '}
                    <Typography.Text strong>Informes Configurables</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Informativo por ahora (no cambia el comportamiento de la app).
                    </Typography.Paragraph>
                  </span>
                )} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item style={{ marginBottom: 8 }}>
                <Controller name="plugins.progress_bar" control={control} render={({ field }) => (
                  <span>
                    <Switch id="plugins_progress_bar" checked={field.value} onChange={field.onChange} />{' '}
                    <Typography.Text strong>Barra de Progreso</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      Informativo por ahora (no cambia el comportamiento de la app).
                    </Typography.Paragraph>
                  </span>
                )} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <div className="form-actions">
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
            Guardar ajustes
          </Button>
        </div>
      </Form>

      <Card title="Logo y firma" style={{ margin: 16 }}>
        <Typography.Paragraph type="secondary">
          Se incluyen en los PDF de informes y certificados. La vista se actualiza automáticamente tras la subida.
        </Typography.Paragraph>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <h3>Logo</h3>
            {data?.logo_path ? <Image src={resolveAssetUrl(data.logo_path)} alt="logo" width={200} /> : <div>No hay logo configurado</div>}
            <Upload customRequest={(opts) => uploadRequest(opts, 'logo')} showUploadList={false} disabled={!admin}>
              <Button icon={<InboxOutlined />} style={{ marginTop: 8 }} disabled={!admin} loading={loadingUpload}>Subir logo</Button>
            </Upload>
          </Col>
          <Col xs={24} md={12}>
            <h3>Firma</h3>
            {data?.signature_path ? <Image src={resolveAssetUrl(data.signature_path)} alt="signature" width={200} /> : <div>No hay firma configurada</div>}
            <Upload customRequest={(opts) => uploadRequest(opts, 'signature')} showUploadList={false} disabled={!admin}>
              <Button icon={<InboxOutlined />} style={{ marginTop: 8 }} disabled={!admin} loading={loadingUpload}>Subir firma</Button>
            </Upload>
          </Col>
        </Row>
      </Card>

      <Modal title="Configurar token de Moodle" open={tokenModalVisible} onOk={handleTokenSave} onCancel={() => setTokenModalVisible(false)} okText="Guardar">
        <Form layout="vertical">
          <Form.Item label="Token de Moodle">
            <Input.Password value={tokenValue} onChange={(e) => setTokenValue(e.target.value)} autoComplete="new-password" />
          </Form.Item>
          <p>El token se enviará al servidor y se guardará cifrado; no se mostrará en la UI.</p>
        </Form>
      </Modal>
    </div>
  );
}
