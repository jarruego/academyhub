import { Modal, Form, Select, Radio, Button, message, Typography, Input, Divider, Collapse, Checkbox, Progress, Alert } from 'antd';
import { useMailTemplatesQuery } from '../../hooks/api/mail/use-mail-templates';
import { useSmtpSettingsQuery } from '../../hooks/api/mail/use-smtp-settings';
import { useSendMailMutation } from '../../hooks/api/mail/use-send-mail.mutation';
import { useSendCustomMailMutation } from '../../hooks/api/mail/use-send-custom-mail.mutation';
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

  // Estados para el progreso y resultados
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  const [showResultModal, setShowResultModal] = useState(false);
  const [finalResults, setFinalResults] = useState<{ sent: number; skipped: number; failed: number } | null>(null);

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

  const formatDate = (value?: string | Date | null) => {
    if (!value) return '';
    const d = dayjs(value);
    return d.isValid() ? d.format('DD/MM/YYYY') : '';
  };

  const startLabel = formatDate(groupStart ?? null);
  const endLabel = formatDate(groupEnd ?? null);

  const handleSend = async () => {
    if (!users || users.length === 0) {
      messageApi.warning('No hay usuarios seleccionados');
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

    const start = formatDate(groupStart ?? null);
    const end = formatDate(groupEnd ?? null);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    setIsSending(true);
    setSendingProgress({ current: 0, total: users.length });

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      setSendingProgress({ current: i + 1, total: users.length });

      if (!user.email) {
        skipped += 1;
        continue;
      }
      try {
        if (sendMode === 'template') {
          await sendMail({
            userId: user.id_user,
            templateId: selectedTemplate as number,
            courseName: courseName ?? '',
            courseStart: start,
            courseEnd: end,
            replyTo: fromChoice === 'auth' ? authEmail : smtp?.from_email,
            toEmail: user.email,
            sendViaMoodle,
            authUserId: authInfo?.user?.id,
            fromName: fromChoice === 'auth' ? authInfo?.user?.name : undefined,
          });
        } else {
          await sendCustomMail({
            to: user.email,
            subject: customSubject.trim(),
            html: customIsHtml ? customContent : undefined,
            text: !customIsHtml ? customContent : undefined,
            reply_to: fromChoice === 'auth' ? authEmail : smtp?.from_email,
            from_name: fromChoice === 'auth' ? authInfo?.user?.name : undefined,
            sendViaMoodle,
            authUserId: authInfo?.user?.id,
            userId: user.id_user,
          });
        }
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    setIsSending(false);
    setFinalResults({ sent, skipped, failed });
    setShowResultModal(true);
  };

  return (
    <>
      {messageContextHolder}

      {/* Modal de progreso */}
      <Modal
        title="Enviando correos..."
        open={isSending}
        closable={false}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={Math.round((sendingProgress.current / sendingProgress.total) * 100)}
            width={120}
          />
          <div style={{ marginTop: 16 }}>
            <Typography.Text>
              {sendingProgress.current} de {sendingProgress.total} correos enviados
            </Typography.Text>
          </div>
        </div>
      </Modal>

      {/* Modal de resultados */}
      <Modal
        title="Envío completado"
        open={showResultModal}
        onCancel={() => {
          setShowResultModal(false);
          setFinalResults(null);
          setSelectedTemplate(undefined);
          setFromChoice('default');
          setCustomSubject('');
          setCustomContent('');
          setCustomIsHtml(false);
          setSendViaMoodle(false);
          onOk?.();
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => {
            setShowResultModal(false);
            setFinalResults(null);
            setSelectedTemplate(undefined);
            setFromChoice('default');
            setCustomSubject('');
            setCustomContent('');
            setCustomIsHtml(false);
            setSendViaMoodle(false);
            onOk?.();
          }}>
            Cerrar
          </Button>,
        ]}
        width={400}
      >
        {finalResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {finalResults.failed === 0 ? (
              <Alert
                type="success"
                message="Todos los correos se enviaron correctamente"
                showIcon
              />
            ) : (
              <Alert
                type="warning"
                message={`Se encontraron ${finalResults.failed} error${finalResults.failed !== 1 ? 's' : ''}`}
                showIcon
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <Typography.Text>✓ Enviados:</Typography.Text>
              <Typography.Text strong>{finalResults.sent}</Typography.Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <Typography.Text>⊘ Omitidos:</Typography.Text>
              <Typography.Text strong>{finalResults.skipped}</Typography.Text>
            </div>
            {finalResults.failed > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <Typography.Text>✕ Fallidos:</Typography.Text>
                <Typography.Text strong style={{ color: '#ff4d4f' }}>{finalResults.failed}</Typography.Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal principal */}
      <Modal
        title="Enviar correo"
        open={open && !isSending}
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

          <Form.Item>
            <Checkbox checked={sendViaMoodle} onChange={(e) => setSendViaMoodle(e.target.checked)}>
              Enviar Notificación por Plataforma Moodle ({authInfo?.user?.name || 'Usuario'})
            </Checkbox>
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
