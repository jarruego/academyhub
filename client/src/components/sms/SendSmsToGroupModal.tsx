import { App, Modal, Form, Select, Button, Typography, Input, Progress, Alert } from 'antd';
import axios from 'axios';
import { useSmsTemplatesQuery } from '../../hooks/api/sms/use-sms-templates';
import { useSmsSettingsQuery } from '../../hooks/api/sms/use-sms-settings';
import { useSendSmsMutation } from '../../hooks/api/sms/use-send-sms.mutation';
import { useSendTestSms } from '../../hooks/api/sms/use-sms-test';
import { useSmsPreviewLengthMutation, type SmsPreviewLengthResponse } from '../../hooks/api/sms/use-sms-preview-length.mutation';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

// El backend propaga el mensaje real de Mailrelay (401/422/...) en
// InternalServerErrorException; mostrarlo es clave para diagnosticar.
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) return Array.isArray(data.message) ? data.message.join(', ') : data.message;
  }
  return fallback;
};

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
  const previewLengthMutation = useSmsPreviewLengthMutation();
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

  // Longitud/partes reales del SMS (variables + pie de baja sustituidos),
  // calculada en el backend para un alumno de muestra (el primero con
  // teléfono) — sin exponer su clave de Moodle, solo el recuento. Aviso
  // ANTES de enviar: si supera el límite, se bloquea el botón "Enviar".
  const sampleUser = users.find((u) => !!u.phone) ?? users[0];
  const [lengthPreview, setLengthPreview] = useState<SmsPreviewLengthResponse | null>(null);
  const [lengthPreviewLoading, setLengthPreviewLoading] = useState(false);
  const exceedsLengthLimit = !!lengthPreview && lengthPreview.parts > lengthPreview.limitParts;

  useEffect(() => {
    if (!open || !selectedTemplate) {
      setLengthPreview(null);
      return;
    }
    let cancelled = false;
    setLengthPreviewLoading(true);
    previewLengthMutation
      .mutateAsync({
        templateId: selectedTemplate,
        userId: sampleUser?.id_user,
        courseName: courseName ?? '',
        courseStart: startLabel,
        courseEnd: endLabel,
      })
      .then((result) => {
        if (!cancelled) setLengthPreview(result);
      })
      .catch(() => {
        if (!cancelled) setLengthPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLengthPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedTemplate, sampleUser?.id_user, courseName, startLabel, endLabel]);

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

  const handleSendClick = async () => {
    if (exceedsLengthLimit && lengthPreview) {
      const limitChars = lengthPreview.encoding === 'GSM-7' ? 160 : 70;
      messageApi.error(
        `El SMS supera ${lengthPreview.limitParts} SMS (${limitChars} caracteres): tiene ${lengthPreview.length} caracteres. Acorta la plantilla o el nombre del curso.`,
        8,
      );
      return;
    }
    await handleSend();
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
      messageApi.error(getErrorMessage(err, 'Error al enviar el SMS de prueba'), 8);
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
          <Button key="submit" type="primary" loading={isPending} disabled={exceedsLengthLimit} onClick={handleSendClick}>Enviar</Button>,
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
              <div style={{ marginTop: 6 }}>
                {lengthPreviewLoading ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Calculando longitud real…</Typography.Text>
                ) : lengthPreview ? (
                  <Typography.Text type={exceedsLengthLimit ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                    {lengthPreview.length} caracteres · {lengthPreview.encoding} · {lengthPreview.parts} parte{lengthPreview.parts === 1 ? '' : 's'} de {lengthPreview.limitParts}
                    {' '}(mensaje final ya con variables y "Baja SMS:" sustituidos, según {sampleUser ? 'el primer alumno con teléfono' : 'la plantilla'})
                  </Typography.Text>
                ) : null}
              </div>
              {exceedsLengthLimit && lengthPreview && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="error"
                  showIcon
                  message={`Supera el límite de ${lengthPreview.limitParts} SMS (${lengthPreview.encoding === 'GSM-7' ? 160 : 70} caracteres). Acorta la plantilla o el nombre del curso antes de enviar.`}
                />
              )}
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
