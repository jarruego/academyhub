import { useEffect, useState } from 'react';
import { App, Button, Card, Input, Modal, Typography } from 'antd';
import { useSmsSettingsQuery, useSaveSmsSettingsMutation } from '../../hooks/api/sms/use-sms-settings';
import { useTestSmsConnection, useSendTestSms } from '../../hooks/api/sms/use-sms-test';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import type { SmsSettingsForm } from '../../shared/types/sms/sms-settings.types';

const SMS_SETTINGS_SCHEMA: z.ZodType<SmsSettingsForm> = z.object({
  account_url: z.string().min(1, 'La cuenta de Mailrelay es obligatoria'),
  // La api_key puede ir vacía: significa "mantener la actual". La obligatoriedad
  // cuando no hay una guardada se valida en el submit (ver onSubmit).
  api_key: z.string(),
  sender_name: z.string().min(1, 'El remitente es obligatorio').max(20, 'Máximo 20 caracteres'),
});

export default function SmsConfigTab() {
  const { message: messageApi } = App.useApp();
  const { data, isLoading, refetch } = useSmsSettingsQuery();
  const saveMutation = useSaveSmsSettingsMutation();
  const testConnection = useTestSmsConnection();
  const sendTestSms = useSendTestSms();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Mensaje de prueba desde AcademyHub.');
  // Indica si ya hay una api_key guardada en el servidor. La api_key real
  // nunca se descarga al cliente; el backend la devuelve enmascarada.
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const { handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<SmsSettingsForm>({
    resolver: zodResolver(SMS_SETTINGS_SCHEMA),
    defaultValues: {
      account_url: '',
      api_key: '',
      sender_name: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (data) {
      const sms = data as SmsSettingsForm & { hasApiKey?: boolean };
      setHasStoredApiKey(!!sms.hasApiKey);
      reset({
        account_url: sms.account_url ?? '',
        // La api_key real nunca llega al cliente: el campo arranca vacío.
        // Dejarlo vacío al guardar mantiene la api_key ya almacenada.
        api_key: '',
        sender_name: sms.sender_name ?? '',
      });
    }
  }, [data, reset]);

  const onSubmit = async (values: SmsSettingsForm) => {
    if (!hasStoredApiKey && !values.api_key) {
      messageApi.error('La API key de Mailrelay es obligatoria');
      return;
    }
    try {
      await saveMutation.mutateAsync(values);
      messageApi.success('Configuración SMS guardada');
      refetch();
    } catch {
      messageApi.error('Error al guardar la configuración');
    }
  };

  const handleTestConnection = handleSubmit(async (values) => {
    try {
      await testConnection.mutateAsync(values);
      messageApi.success('Conexión con Mailrelay correcta');
    } catch {
      messageApi.error('Error de conexión con Mailrelay');
    }
  });

  const handleSendTestSms = handleSubmit(async (values) => {
    if (!testPhone.trim()) {
      messageApi.warning('Introduce un teléfono de destino');
      return;
    }
    try {
      await sendTestSms.mutateAsync({
        to: testPhone.trim(),
        message: testMessage,
        senderName: values.sender_name,
      });
      messageApi.success('SMS de prueba enviado');
      setTestModalOpen(false);
    } catch {
      messageApi.error('Error al enviar el SMS de prueba');
    }
  });

  if (isLoading) {
    return <Card title="Configuración SMS" style={{ maxWidth: 500, margin: '0 auto' }} loading />;
  }

  return (
    <>
      <Card title="Configuración SMS (Mailrelay)" style={{ maxWidth: 500, margin: '0 auto' }}>
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
          <div style={{ marginBottom: 16 }}>
            <label>Cuenta Mailrelay *</label>
            <Controller
              name="account_url"
              control={control}
              render={({ field }) => (
                <Input {...field} placeholder="ej. mecohisa1.ipzmarketing.com" status={errors?.account_url ? 'error' : undefined} />
              )}
            />
            {errors?.account_url && <div style={{ color: 'red' }}>{errors.account_url?.message}</div>}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Subdominio de tu cuenta Mailrelay, sin "https://" (ej. mecohisa1.ipzmarketing.com).
            </Typography.Text>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>{hasStoredApiKey ? 'API key' : 'API key *'}</label>
            <Controller
              name="api_key"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  status={errors?.api_key ? 'error' : undefined}
                  autoComplete="new-password"
                  placeholder={hasStoredApiKey ? 'Dejar en blanco para mantener la actual' : undefined}
                />
              )}
            />
            {errors?.api_key && <div style={{ color: 'red' }}>{errors.api_key?.message}</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Remitente por defecto *</label>
            <Controller
              name="sender_name"
              control={control}
              render={({ field }) => (
                <Input {...field} maxLength={20} status={errors?.sender_name ? 'error' : undefined} />
              )}
            />
            {errors?.sender_name && <div style={{ color: 'red' }}>{errors.sender_name?.message}</div>}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Nombre que verán los destinatarios (alfanumérico, recomendado máx. 11 caracteres). Editable en cada envío.
            </Typography.Text>
          </div>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending || isSubmitting} style={{ width: '100%' }}>
            Guardar
          </Button>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <Button onClick={handleTestConnection} loading={testConnection.isPending} disabled={isSubmitting}>
            Probar conexión
          </Button>
          <Button onClick={() => setTestModalOpen(true)} loading={sendTestSms.isPending} disabled={isSubmitting}>
            Enviar SMS de prueba
          </Button>
        </div>
        <Modal
          title="Enviar SMS de prueba"
          open={testModalOpen}
          onOk={handleSendTestSms}
          onCancel={() => setTestModalOpen(false)}
          okText="Enviar"
          confirmLoading={sendTestSms.isPending}
        >
          <div style={{ marginBottom: 12 }}>
            <label>Teléfono destino</label>
            <Input
              placeholder="ej. 600000000 o +34600000000"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <div>
            <label>Mensaje</label>
            <Input.TextArea
              rows={3}
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              maxLength={480}
              showCount
            />
          </div>
        </Modal>
      </Card>
    </>
  );
}
