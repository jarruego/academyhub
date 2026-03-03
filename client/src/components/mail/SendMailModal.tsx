import { Modal, Form, Select, Radio, Button, message, Typography, Input, Divider, Collapse, Checkbox } from 'antd';
import { useMailTemplatesQuery } from '../../hooks/api/mail/use-mail-templates';
import { useSmtpSettingsQuery } from '../../hooks/api/mail/use-smtp-settings';
import { useSendMailMutation } from '../../hooks/api/mail/use-send-mail.mutation';
import { useSendCustomMailMutation } from '../../hooks/api/mail/use-send-custom-mail.mutation';
import { useState } from 'react';
import { useAuthInfo } from '../../providers/auth/auth.context';
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
  const { mutateAsync: sendCustomMail, isPending: isCustomPending } = useSendCustomMailMutation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { authInfo } = useAuthInfo();

  const [sendMode, setSendMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [fromChoice, setFromChoice] = useState<'default' | 'auth'>('default');
  const [customSubject, setCustomSubject] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [customIsHtml, setCustomIsHtml] = useState(false);
  const [sendViaMoodle, setSendViaMoodle] = useState(false);
  const smtp = smtpSettings as SmtpSettingsForm | undefined;
  const authEmail = authInfo?.user?.email || '';

  const selectedTemplateData = templates?.find((t) => t.id === selectedTemplate);

  const renderPreview = (subject?: string, content?: string, isHtml?: boolean) => {
    const previewContent = content ?? '';
    return (
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, background: '#fafafa' }}>
        <Typography.Text strong>Asunto:</Typography.Text>
        <div style={{ marginBottom: 8 }}>{subject || 'Sin asunto'}</div>
        <Typography.Text strong>Contenido:</Typography.Text>
        {isHtml ? (
          <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: previewContent }} />
        ) : (
          <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{previewContent || 'Sin contenido'}</div>
        )}
      </div>
    );
  };

  const handleSend = async () => {
    if (!userEmail) {
      messageApi.error('El usuario no tiene email');
      return;
    }
    if (fromChoice === 'auth' && !authEmail) {
      messageApi.error('El usuario autenticado no tiene email');
      return;
    }

    if (sendMode === 'template') {
      if (!selectedTemplate) {
        messageApi.warning('Selecciona una plantilla');
        return;
      }
    } else {
      if (!customSubject.trim()) {
        messageApi.warning('El asunto es obligatorio');
        return;
      }
      if (!customContent.trim()) {
        messageApi.warning('El contenido es obligatorio');
        return;
      }
    }

    try {
      if (sendMode === 'template') {
        await sendMail({
          userId,
          templateId: selectedTemplate as number,
          replyTo: fromChoice === 'auth' ? authEmail : smtp?.from_email,
          toEmail: userEmail,
          sendViaMoodle,
          authUserId: authInfo?.user?.id,
          fromName: fromChoice === 'auth' ? authInfo?.user?.name : undefined,
        });
      } else {
        await sendCustomMail({
          to: userEmail,
          subject: customSubject.trim(),
          html: customIsHtml ? customContent : undefined,
          text: !customIsHtml ? customContent : undefined,
          reply_to: fromChoice === 'auth' ? authEmail : smtp?.from_email,
          from_name: fromChoice === 'auth' ? authInfo?.user?.name : undefined,
          sendViaMoodle,
          authUserId: authInfo?.user?.id,          userId,        });
      }

      messageApi.success('Correo enviado correctamente');
      setSelectedTemplate(undefined);
      setFromChoice('default');
      setCustomSubject('');
      setCustomContent('');
      setCustomIsHtml(false);
      setSendViaMoodle(false);
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
          <Button key="submit" type="primary" loading={isPending || isCustomPending} onClick={handleSend}>
            Enviar
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Tipo de envío" required>
            <Radio.Group value={sendMode} onChange={(e) => setSendMode(e.target.value)}>
              <Radio value="template">Plantilla</Radio>
              <Radio value="custom">Correo personalizado</Radio>
            </Radio.Group>
          </Form.Item>

          {sendMode === 'template' && (
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
          )}

          {sendMode === 'custom' && (
            <>
              <Form.Item label="Asunto" required>
                <Input
                  placeholder="Asunto del correo"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Formato" required>
                <Radio.Group
                  value={customIsHtml ? 'html' : 'text'}
                  onChange={(e) => setCustomIsHtml(e.target.value === 'html')}
                >
                  <Radio value="text">Texto</Radio>
                  <Radio value="html">HTML</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="Contenido" required>
                <Input.TextArea
                  rows={6}
                  placeholder="Escribe el contenido del correo"
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                />
              </Form.Item>
            </>
          )}

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

          <Form.Item>
            <Checkbox checked={sendViaMoodle} onChange={(e) => setSendViaMoodle(e.target.checked)}>
              Enviar Notificación por Plataforma Moodle ({authInfo?.user?.name || 'Usuario'})
            </Checkbox>
          </Form.Item>

          <Form.Item label="Destinatario">
            <Typography.Text>{userEmail || 'Sin email'}</Typography.Text>
          </Form.Item>

          {sendMode === 'template' && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Collapse
                items={[
                  {
                    key: 'preview',
                    label: 'Vista previa',
                    children: renderPreview(
                      selectedTemplateData?.subject || selectedTemplateData?.name,
                      selectedTemplateData?.content,
                      selectedTemplateData?.is_html
                    ),
                  },
                ]}
                defaultActiveKey={[]}
              />
            </>
          )}
        </Form>
      </Modal>
    </>
  );
}
