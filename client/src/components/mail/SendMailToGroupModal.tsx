import { Modal, Form, Select, Radio, Button, message, Typography } from 'antd';
import { useMailTemplatesQuery } from '../../hooks/api/mail/use-mail-templates';
import { useSmtpSettingsQuery } from '../../hooks/api/mail/use-smtp-settings';
import { useSendMailMutation } from '../../hooks/api/mail/use-send-mail.mutation';
import { useState } from 'react';
import { useAuthInfo } from '../../providers/auth/auth.context';
import type { SmtpSettingsForm } from '../../shared/types/mail/smtp-settings.types';
import dayjs from 'dayjs';

interface GroupUserRef {
  id_user: number;
  email?: string | null;
}

interface SendMailToGroupModalProps {
  open: boolean;
  users: GroupUserRef[];
  courseName?: string;
  groupStart?: string | Date | null;
  groupEnd?: string | Date | null;
  onOk?: () => void;
  onCancel: () => void;
}

export default function SendMailToGroupModal({ open, users, courseName, groupStart, groupEnd, onOk, onCancel }: SendMailToGroupModalProps) {
  const { data: templates, isLoading: templatesLoading } = useMailTemplatesQuery();
  const { data: smtpSettings } = useSmtpSettingsQuery();
  const { mutateAsync: sendMail, isPending } = useSendMailMutation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { authInfo } = useAuthInfo();

  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [fromChoice, setFromChoice] = useState<'default' | 'auth'>('default');
  const smtp = smtpSettings as SmtpSettingsForm | undefined;
  const authEmail = authInfo?.user?.email || '';

  const formatDate = (value?: string | Date | null) => {
    if (!value) return '';
    const d = dayjs(value);
    return d.isValid() ? d.format('DD/MM/YYYY') : '';
  };

  const startLabel = formatDate(groupStart ?? null);
  const endLabel = formatDate(groupEnd ?? null);

  const handleSend = async () => {
    if (!selectedTemplate) {
      messageApi.warning('Selecciona una plantilla');
      return;
    }
    if (!users || users.length === 0) {
      messageApi.warning('No hay usuarios seleccionados');
      return;
    }
    if (fromChoice === 'auth' && !authEmail) {
      messageApi.error('El usuario autenticado no tiene email');
      return;
    }

    const start = formatDate(groupStart ?? null);
    const end = formatDate(groupEnd ?? null);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.email) {
        skipped += 1;
        continue;
      }
      try {
        await sendMail({
          userId: user.id_user,
          templateId: selectedTemplate,
          courseName: courseName ?? '',
          courseStart: start,
          courseEnd: end,
          fromEmail: fromChoice === 'auth' ? authEmail : undefined,
          toEmail: user.email,
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    if (failed === 0) {
      messageApi.success(`Correos enviados: ${sent}. Omitidos: ${skipped}.`);
      setSelectedTemplate(undefined);
      setFromChoice('default');
      onOk?.();
    } else {
      messageApi.error(`Enviados: ${sent}. Omitidos: ${skipped}. Fallidos: ${failed}.`);
    }
  };

  return (
    <>
      {messageContextHolder}
      <Modal
        title="Enviar correo"
        open={open}
        onCancel={onCancel}
        width={560}
        styles={{ body: { minHeight: 220 } }}
        footer={[
          <Button key="cancel" onClick={onCancel}>
            Cancelar
          </Button>,
          <Button key="submit" type="primary" loading={isPending} onClick={handleSend}>
            Enviar
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Plantilla de correo" required>
            <Select
              placeholder="Selecciona una plantilla"
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              loading={templatesLoading}
            >
              {templates?.map((template) => (
                <Select.Option key={template.id} value={template.id}>
                  {template.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Remitente" required>
            <Radio.Group value={fromChoice} onChange={(e) => setFromChoice(e.target.value)}>
              <Radio value="default">
                Remitente por defecto ({smtp?.from_email || 'no configurado'})
              </Radio>
              <Radio value="auth">
                Email del usuario autenticado ({authEmail || 'sin email'})
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Curso">
            <Typography.Text>{courseName || 'Sin curso'}</Typography.Text>
          </Form.Item>

          <Form.Item label="Fechas del grupo">
            <Typography.Text>{startLabel || 'Sin fecha inicio'} — {endLabel || 'Sin fecha fin'}</Typography.Text>
          </Form.Item>

          <Form.Item label="Destinatarios seleccionados">
            <Typography.Text>{users.length}</Typography.Text>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
