import { App, Modal, Form, Select, Button, Typography, Input, Progress, Alert } from 'antd';
import { useSmsTemplatesQuery } from '../../hooks/api/sms/use-sms-templates';
import { useSmsSettingsQuery } from '../../hooks/api/sms/use-sms-settings';
import { useSendSmsMutation } from '../../hooks/api/sms/use-send-sms.mutation';
import { useSendTestSms } from '../../hooks/api/sms/use-sms-test';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

interface GroupUserRef {
  id_user: number;
  phone?: string | null;
}

interface SendSmsToGroupModalProps {
  open: boolean;
  users: GroupUserRef[];
  courseName?: string;
  groupStart?: string | Date | null;
  groupEnd?: string | Date | null;
  onOk?: () => void;
  onCancel: () => void;
}

export default function SendSmsToGroupModal({ open, users, courseName, groupStart, groupEnd, onOk, onCancel }: SendSmsToGroupModalProps) {
  const { data: templates, isLoading: templatesLoading } = useSmsTemplatesQuery();
  const { data: smsSettings } = useSmsSettingsQuery();
  const { mutateAsync: sendSms, isPending } = useSendSmsMutation();
  const { mutateAsync: sendTestSms, isPending: isTestPending } = useSendTestSms();
  const { message: messageApi } = App.useApp();

  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [senderName, setSenderName] = useState('');

  useEffect(() => {
    if (open && smsSettings && !senderName) {
      setSenderName((smsSettings as { sender_name?: string }).sender_name ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, smsSettings]);

  // Estados para el progreso y resultados
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });
  const [showResultModal, setShowResultModal] = useState(false);
  const [finalResults, setFinalResults] = useState<{ sent: number; skipped: number; failed: number } | null>(null);

  // Estados para el envío de prueba
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isTestSending, setIsTestSending] = useState(false);

  const selectedTemplateData = templates?.find((t) => t.id === selectedTemplate);

  const formatDate = (value?: string | Date | null) => {
    if (!value) return '';
    const d = dayjs(value);
    return d.isValid() ? d.format('DD/MM/YYYY') : '';
  };

  const startLabel = formatDate(groupStart ?? null);
  const endLabel = formatDate(groupEnd ?? null);

  const resetState = () => {
    setSelectedTemplate(undefined);
    setSenderName((smsSettings as { sender_name?: string } | undefined)?.sender_name ?? '');
  };

  const validateBeforeSend = (): boolean => {
    if (!senderName.trim()) {
      messageApi.error('El remitente es obligatorio');
      return false;
    }
    if (!selectedTemplate) {
      messageApi.warning('Selecciona una plantilla');
      return false;
    }
    return true;
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      messageApi.warning('Introduce un teléfono válido');
      return;
    }
    if (!validateBeforeSend()) return;

    setIsTestSending(true);
    try {
      await sendTestSms({
        to: testPhone.trim(),
        message: selectedTemplateData?.message ?? '',
        senderName: senderName.trim(),
      });
      messageApi.success(`SMS de prueba enviado a ${testPhone.trim()}`);
      setTestModalOpen(false);
      setTestPhone('');
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : 'Error al enviar el SMS de prueba');
    } finally {
      setIsTestSending(false);
    }
  };

  const handleSend = async () => {
    if (!users || users.length === 0) {
      messageApi.warning('No hay usuarios seleccionados');
      return;
    }
    if (!validateBeforeSend()) return;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    setIsSending(true);
    setSendingProgress({ current: 0, total: users.length });

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      setSendingProgress({ current: i + 1, total: users.length });

      if (!user.phone) {
        skipped += 1;
        continue;
      }
      try {
        await sendSms({
          userId: user.id_user,
          templateId: selectedTemplate as number,
          courseName: courseName ?? '',
          courseStart: startLabel,
          courseEnd: endLabel,
          toPhone: user.phone,
          senderName: senderName.trim(),
        });
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
      {/* Modal de progreso */}
      <Modal title="Enviando SMS..." open={isSending} closable={false} footer={null} width={400}>
        <div style={{ textAlign: 'center' }}>
          <Progress type="circle" percent={Math.round((sendingProgress.current / sendingProgress.total) * 100)} size={120} />
          <div style={{ marginTop: 16 }}>
            <Typography.Text>
              {sendingProgress.current} de {sendingProgress.total} SMS enviados
            </Typography.Text>
          </div>
        </div>
      </Modal>

      {/* Modal de resultados */}
      <Modal
        title="Envío completado"
        open={showResultModal}
        onCancel={() => { setShowResultModal(false); setFinalResults(null); resetState(); onOk?.(); }}
        footer={[
          <Button key="close" type="primary" onClick={() => { setShowResultModal(false); setFinalResults(null); resetState(); onOk?.(); }}>
            Cerrar
          </Button>,
        ]}
        width={400}
      >
        {finalResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {finalResults.failed === 0 ? (
              <Alert type="success" message="Todos los SMS se enviaron correctamente" showIcon />
            ) : (
              <Alert type="warning" message={`Se encontraron ${finalResults.failed} error${finalResults.failed !== 1 ? 's' : ''}`} showIcon />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <Typography.Text>✓ Enviados:</Typography.Text>
              <Typography.Text strong>{finalResults.sent}</Typography.Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <Typography.Text>⊘ Omitidos (sin teléfono):</Typography.Text>
              <Typography.Text strong>{finalResults.skipped}</Typography.Text>
            </div>
            {finalResults.failed > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <Typography.Text>✕ Fallidos:</Typography.Text>
                <Typography.Text strong type="danger">{finalResults.failed}</Typography.Text>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal principal */}
      <Modal
        title="Enviar SMS"
        open={open && !isSending}
        onCancel={onCancel}
        width={480}
        footer={[
          <Button key="cancel" onClick={onCancel}>Cancelar</Button>,
          <Button key="test" onClick={() => setTestModalOpen(true)}>Enviar prueba</Button>,
          <Button key="submit" type="primary" loading={isPending} onClick={handleSend}>Enviar</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Plantilla de SMS" required>
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
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} maxLength={20} />
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

          {selectedTemplateData && (
            <Form.Item label="Vista previa">
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: 12, whiteSpace: 'pre-wrap' }}>
                {selectedTemplateData.message}
              </div>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Modal de envío de prueba */}
      <Modal
        title="Enviar SMS de prueba"
        open={testModalOpen}
        onCancel={() => { setTestModalOpen(false); setTestPhone(''); }}
        onOk={handleSendTest}
        okText="Enviar"
        confirmLoading={isTestSending || isTestPending}
        width={420}
      >
        <Form layout="vertical">
          <Form.Item label="Teléfono de prueba" required>
            <Input
              placeholder="ej. 600000000 o +34600000000"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              onPressEnter={handleSendTest}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            Se enviará el texto tal cual de la plantilla (sin sustituir variables) a este teléfono.
          </Typography.Text>
        </Form>
      </Modal>
    </>
  );
}
