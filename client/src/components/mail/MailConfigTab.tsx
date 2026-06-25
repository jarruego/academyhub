import { useEffect, useState } from 'react';
import { App, Button, Card, Input, InputNumber, Switch, Modal } from 'antd';
import { useSmtpSettingsQuery, useSaveSmtpSettingsMutation } from '../../hooks/api/mail/use-smtp-settings';
import { useTestSmtpConnection, useSendTestMail } from '../../hooks/api/mail/use-smtp-test';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import type { SmtpSettingsForm } from '../../shared/types/mail/smtp-settings.types';

const SMTP_SCHEMA: z.ZodType<SmtpSettingsForm> = z.object({
  host: z.string().min(1, 'El servidor es obligatorio'),
  port: z.coerce.number().int().min(1, 'El puerto es obligatorio'),
  user: z.string().min(1, 'El usuario es obligatorio'),
  // La contraseña puede ir vacía: significa "mantener la actual". La obligatoriedad
  // cuando no hay contraseña guardada se valida en el submit (ver onSubmit).
  password: z.string(),
  secure: z.boolean(),
  from_email: z.string().email('Introduce un email válido'),
  from_name: z.string().optional(),
});

export default function MailConfigTab() {
  const { message: messageApi } = App.useApp();
  const { data, isLoading, refetch } = useSmtpSettingsQuery();
  const saveMutation = useSaveSmtpSettingsMutation();
  const testConnection = useTestSmtpConnection();
  const sendTestMail = useSendTestMail();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  // Indica si ya hay una contraseña SMTP guardada en el servidor. La contraseña
  // real nunca se descarga al cliente; el backend la devuelve enmascarada.
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const { handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<SmtpSettingsForm>({
    resolver: zodResolver(SMTP_SCHEMA),
    defaultValues: {
      host: '',
      port: 465,
      user: '',
      password: '',
      secure: true,
      from_email: '',
      from_name: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (data) {
      const smtp = data as SmtpSettingsForm & { hasPassword?: boolean };
      setHasStoredPassword(!!smtp.hasPassword);
      reset({
        host: smtp.host ?? '',
        port: typeof smtp.port === 'number' ? smtp.port : 465,
        user: smtp.user ?? '',
        // La contraseña real nunca llega al cliente: el campo arranca vacío.
        // Dejarlo vacío al guardar mantiene la contraseña ya almacenada.
        password: '',
        secure: typeof smtp.secure === 'boolean' ? smtp.secure : true,
        from_email: smtp.from_email ?? '',
        from_name: smtp.from_name ?? '',
      });
    }
  }, [data, reset]);

  const onSubmit = async (values: SmtpSettingsForm) => {
    // Si no hay contraseña guardada todavía, es obligatorio introducir una.
    if (!hasStoredPassword && !values.password) {
      messageApi.error('La contraseña es obligatoria');
      return;
    }
    try {
      await saveMutation.mutateAsync(values);
      messageApi.success('Configuración SMTP guardada');
      refetch();
    } catch (e) {
      messageApi.error('Error al guardar la configuración');
    }
  };

  const handleTestConnection = handleSubmit(async (values) => {
    try {
      await testConnection.mutateAsync(values);
      messageApi.success('Conexión SMTP correcta');
    } catch (e) {
      messageApi.error('Error de conexión SMTP');
    }
  });

  const handleSendTestMail = handleSubmit(async (values) => {
    try {
      await sendTestMail.mutateAsync({
        to: testEmail,
        subject: 'Correo de prueba SMTP',
        text: 'Este es un correo de prueba.',
        smtp: values,
      });
      messageApi.success('Correo de prueba enviado');
      setTestModalOpen(false);
    } catch (e) {
      messageApi.error('Error al enviar el correo de prueba');
    }
  });

  if (isLoading) {
    return <Card title="Configuración SMTP" style={{ maxWidth: 500, margin: '0 auto' }} loading />;
  }

  return (
    <>
      <Card title="Configuración SMTP" style={{ maxWidth: 500, margin: '0 auto' }}>
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
          <div style={{ marginBottom: 16 }}>
            <label>Servidor *</label>
            <Controller
              name="host"
              control={control}
              render={({ field }) => (
                <Input {...field} status={errors?.host ? 'error' : undefined} />
              )}
            />
            {errors?.host && <div style={{ color: 'red' }}>{errors.host?.message}</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Puerto *</label>
            <Controller
              name="port"
              control={control}
              render={({ field }) => (
                <InputNumber {...field} style={{ width: '100%' }} status={errors?.port ? 'error' : undefined} />
              )}
            />
            {errors?.port && <div style={{ color: 'red' }}>{errors.port?.message}</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Usuario *</label>
            <Controller
              name="user"
              control={control}
              render={({ field }) => (
                <Input {...field} status={errors?.user ? 'error' : undefined} />
              )}
            />
            {errors?.user && <div style={{ color: 'red' }}>{errors.user?.message}</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>{hasStoredPassword ? 'Contraseña' : 'Contraseña *'}</label>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  status={errors?.password ? 'error' : undefined}
                  autoComplete="new-password"
                  placeholder={hasStoredPassword ? 'Dejar en blanco para mantener la actual' : undefined}
                />
              )}
            />
            {errors?.password && <div style={{ color: 'red' }}>{errors.password?.message}</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>SSL/TLS</label>
            <Controller
              name="secure"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Switch checked={!!value} onChange={onChange} />
              )}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Email remitente *</label>
            <Controller
              name="from_email"
              control={control}
              render={({ field }) => (
                <Input {...field} status={errors?.from_email ? 'error' : undefined} />
              )}
            />
            {errors?.from_email && <div style={{ color: 'red' }}>{errors.from_email?.message}</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Nombre remitente</label>
            <Controller
              name="from_name"
              control={control}
              render={({ field }) => (
                <Input {...field} status={errors?.from_name ? 'error' : undefined} />
              )}
            />
          </div>
          <Button type="primary" htmlType="submit" loading={saveMutation.isPending || isSubmitting} style={{ width: '100%' }}>
            Guardar
          </Button>
        </form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <Button onClick={handleTestConnection} loading={testConnection.isPending} disabled={isSubmitting}>
            Probar conexión
          </Button>
          <Button onClick={() => setTestModalOpen(true)} loading={sendTestMail.isPending} disabled={isSubmitting}>
            Enviar correo de prueba
          </Button>
        </div>
        <Modal
          title="Enviar correo de prueba"
          open={testModalOpen}
          onOk={handleSendTestMail}
          onCancel={() => setTestModalOpen(false)}
          okText="Enviar"
          confirmLoading={sendTestMail.isPending}
        >
          <Input
            placeholder="Correo destinatario"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            type="email"
          />
        </Modal>
      </Card>
    </>
  );
}
