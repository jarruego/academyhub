import { Modal, Form, Select, Radio, Button, message, Typography } from 'antd';
import { useMailTemplatesQuery } from '../../hooks/api/mail/use-mail-templates';
import { useSmtpSettingsQuery } from '../../hooks/api/mail/use-smtp-settings';
import { useSendMailMutation } from '../../hooks/api/mail/use-send-mail.mutation';
import { useState } from 'react';
import type { SmtpSettingsForm } from '../../shared/types/mail/smtp-settings.types';

interface SendMailModalProps {
  open: boolean;
  userId: number;
  userEmail: string;
  onOk?: () => void;
  onCancel: () => void;
}

export default function SendMailModal({ open, userId, userEmail, onOk, onCancel }: SendMailModalProps) {
  const { data: templates, isLoading: templatesLoading } = useMailTemplatesQuery();
  const { data: smtpSettings } = useSmtpSettingsQuery();
  const { mutateAsync: sendMail, isPending } = useSendMailMutation();
  const [messageApi, messageContextHolder] = message.useMessage();

  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [fromChoice, setFromChoice] = useState<'default' | 'user'>('default');
  const smtp = smtpSettings as SmtpSettingsForm | undefined;

  const handleSend = async () => {
    if (!selectedTemplate) {
      messageApi.warning('Selecciona una plantilla');
      return;
    }
    if (!userEmail) {
      messageApi.error('El usuario no tiene email');
      return;
    }

    try {
      await sendMail({
        userId,
        templateId: selectedTemplate,
        fromEmail: fromChoice === 'user' ? userEmail : undefined,
        toEmail: userEmail,
      });

      messageApi.success('Correo enviado correctamente');
      setSelectedTemplate(undefined);
      setFromChoice('default');
      onOk?.();
    } catch (err: any) {
      messageApi.error(err?.message || 'Error al enviar el correo');
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
              <Radio value="user">
                Email del usuario ({userEmail || 'sin email'})
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Destinatario">
            <Typography.Text>{userEmail || 'Sin email'}</Typography.Text>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
