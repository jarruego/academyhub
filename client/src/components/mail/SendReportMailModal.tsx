import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { App, Modal, Form, Select, Radio, Button, Typography, Input, Divider, Collapse, Checkbox, Space, Tooltip, theme, Tag } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { BRAND_COLORS } from '../../theme/semantic-colors';
import { useMailTemplatesQuery, useUploadMailTemplateImageMutation } from '../../hooks/api/mail/use-mail-templates';
import { useSmtpSettingsQuery } from '../../hooks/api/mail/use-smtp-settings';
import { useAuthInfo } from '../../providers/auth/auth.context';
import type { SmtpSettingsForm } from '../../shared/types/mail/smtp-settings.types';
import { REPORT_MAIL_TEMPLATE_VARIABLES } from '../../constants/mail/mail-template-variables';
import MailTemplateHtmlEditor from './MailTemplateHtmlEditor';
import type { Editor } from '@tiptap/react';
import { useReportSendGroupsMutation, ReportSendGroupPreview, ReportSendGroupsSelection } from '../../hooks/api/reports/use-report-send-groups.mutation';
import { useReportSendMutation, useReportSendTestMutation, ReportSendResult, ReportAttachmentType } from '../../hooks/api/reports/use-report-send.mutation';
import useReportExport from '../../hooks/api/reports/use-report-export';
import { AuthzHide } from '../permissions/authz-hide';
import { Role } from '../../hooks/api/auth/use-login.mutation';

interface SendReportMailModalProps {
  open: boolean;
  selection: ReportSendGroupsSelection;
  onOk?: () => void;
  onCancel: () => void;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) return Array.isArray(data.message) ? data.message.join(', ') : data.message;
  }
  return fallback;
};

function SendGroupRecipientRow({
  group,
  emails,
  onChange,
  attachDedication,
  attachDedicationPasswords,
  attachCertification,
  onPreview,
}: {
  group: ReportSendGroupPreview;
  emails: string[];
  onChange: (emails: string[]) => void;
  attachDedication: boolean;
  attachDedicationPasswords: boolean;
  attachCertification: boolean;
  onPreview: (type: ReportAttachmentType) => void;
}) {
  const showPreviewRow = attachDedication || attachDedicationPasswords || attachCertification;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Typography.Text strong>{group.center_name}</Typography.Text>
        {group.course_name && <Tag>{group.course_name}</Tag>}
        <Tag>{group.student_count} alumno{group.student_count !== 1 ? 's' : ''}</Tag>
        <Tag color={group.eligible_count > 0 ? 'green' : 'default'}>{group.eligible_count} ≥75%</Tag>
        {group.kind === 'center' && <Tag color="red">Sin petición asociada</Tag>}
      </div>
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder={group.kind === 'center' ? 'Sin petición asociada: escribe el email a mano' : 'Añade uno o varios emails destinatarios'}
        value={emails}
        onChange={onChange}
        tokenSeparators={[',', ' ', ';']}
        notFoundContent={null}
      />
      {showPreviewRow && (
        <Space wrap size="small">
          {attachDedication && (
            <Button size="small" icon={<FilePdfOutlined style={{ color: BRAND_COLORS.pdf }} />} onClick={() => onPreview('dedication')}>
              Dedicación
            </Button>
          )}
          {attachDedicationPasswords && (
            <Button size="small" icon={<FilePdfOutlined style={{ color: BRAND_COLORS.pdf }} />} onClick={() => onPreview('dedication_passwords')}>
              Dedicación con claves
            </Button>
          )}
          {attachCertification && (
            <Button size="small" icon={<FilePdfOutlined style={{ color: BRAND_COLORS.pdf }} />} onClick={() => onPreview('certification')}>
              Certificado
            </Button>
          )}
        </Space>
      )}
    </div>
  );
}

export default function SendReportMailModal({ open, selection, onOk, onCancel }: SendReportMailModalProps) {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { authInfo } = useAuthInfo();
  const { data: templates, isLoading: templatesLoading } = useMailTemplatesQuery();
  const { data: smtpSettings } = useSmtpSettingsQuery();
  const { mutateAsync: uploadImage } = useUploadMailTemplateImageMutation();
  const { mutateAsync: fetchGroups, isPending: groupsLoading, data: groupsData } = useReportSendGroupsMutation();
  const { mutateAsync: sendReport, isPending: isSending } = useReportSendMutation();
  const { mutateAsync: sendTest, isPending: isTestSending } = useReportSendTestMutation();
  const { exportPdf } = useReportExport();
  const smtp = smtpSettings as SmtpSettingsForm | undefined;
  const authEmail = authInfo?.user?.email || '';

  const [sendMode, setSendMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<number | undefined>();
  const [fromChoice, setFromChoice] = useState<'default' | 'auth' | 'manual'>('default');
  const [manualFromName, setManualFromName] = useState('');
  const [manualReplyTo, setManualReplyTo] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [customIsHtml, setCustomIsHtml] = useState(false);
  const [attachDedication, setAttachDedication] = useState(true);
  const [attachDedicationPasswords, setAttachDedicationPasswords] = useState(false);
  const [attachCertification, setAttachCertification] = useState(false);
  const [recipientsByGroup, setRecipientsByGroup] = useState<Record<string, string[]>>({});
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [results, setResults] = useState<ReportSendResult[] | null>(null);
  const htmlEditorRef = useRef<Editor | null>(null);

  // `selection` is typically a fresh object literal on every render of the
  // caller; depend on its serialized value (not identity) so this doesn't
  // refetch (and re-render, and refetch again...) on every render.
  const selectionKey = JSON.stringify(selection ?? {});
  useEffect(() => {
    if (!open) return;
    void fetchGroups(selection).then((res) => {
      const initial: Record<string, string[]> = {};
      for (const g of res.groups) initial[g.group_key] = g.suggested_email ? [g.suggested_email] : [];
      setRecipientsByGroup(initial);
    });
  }, [open, selectionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = groupsData?.groups ?? [];
  const unassignableCount = groupsData?.unassignable_count ?? 0;

  const selectedTemplateData = templates?.find((t) => t.id === selectedTemplate);

  const attach: ReportAttachmentType[] = [
    ...(attachDedication ? (['dedication'] as const) : []),
    ...(attachDedicationPasswords ? (['dedication_passwords'] as const) : []),
    ...(attachCertification ? (['certification'] as const) : []),
  ];

  const buildBasePayload = () => ({
    filter: selection.filter,
    selected_keys: selection.selected_keys,
    attach,
    send_mode: sendMode,
    template_id: sendMode === 'template' ? selectedTemplate : undefined,
    subject: sendMode === 'custom' ? customSubject.trim() : undefined,
    html: sendMode === 'custom' && customIsHtml ? customContent : undefined,
    text: sendMode === 'custom' && !customIsHtml ? customContent : undefined,
    from_name: fromChoice === 'auth' ? authInfo?.user?.name : fromChoice === 'manual' ? manualFromName.trim() || undefined : undefined,
    reply_to: fromChoice === 'auth' ? authEmail : fromChoice === 'manual' ? manualReplyTo.trim() || undefined : smtp?.from_email,
  });

  const handleCustomizeFromTemplate = () => {
    if (!selectedTemplateData) return;
    setCustomSubject(selectedTemplateData.subject || selectedTemplateData.name || '');
    setCustomContent(selectedTemplateData.content || '');
    setCustomIsHtml(!!selectedTemplateData.is_html);
    setSendMode('custom');
  };

  const resetState = () => {
    setSelectedTemplate(undefined);
    setFromChoice('default');
    setManualFromName('');
    setManualReplyTo('');
    setCustomSubject('');
    setCustomContent('');
    setCustomIsHtml(false);
    setAttachDedication(true);
    setAttachDedicationPasswords(false);
    setAttachCertification(false);
    setRecipientsByGroup({});
  };

  const validate = (): boolean => {
    if (!attach.length) { messageApi.warning('Selecciona al menos un informe para adjuntar (Dedicación, Dedicación con claves y/o Certificado)'); return false; }
    if (fromChoice === 'manual' && !manualReplyTo.trim()) { messageApi.warning('Indica el email de respuesta del remitente manual'); return false; }
    if (sendMode === 'template') {
      if (!selectedTemplate) { messageApi.warning('Selecciona una plantilla'); return false; }
    } else {
      if (!customSubject.trim()) { messageApi.warning('El asunto es obligatorio'); return false; }
      if (!customContent.trim()) { messageApi.warning('El contenido es obligatorio'); return false; }
    }
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;
    if (!groups.length) { messageApi.warning('No hay alumnos con petición o centro asociado en la selección'); return; }

    const recipients = groups
      .filter((g) => (recipientsByGroup[g.group_key] ?? []).length > 0)
      .map((g) => ({ group_key: g.group_key, emails: recipientsByGroup[g.group_key] }));

    if (!recipients.length) { messageApi.warning('Indica al menos un destinatario para algún grupo'); return; }

    try {
      const res = await sendReport({ ...buildBasePayload(), recipients });
      setResults(res);
      setResultModalOpen(true);
    } catch (err) {
      messageApi.error(getErrorMessage(err, 'Error al enviar el informe'));
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      messageApi.warning('Introduce un email válido');
      return;
    }
    if (!validate()) return;
    try {
      const res = await sendTest({ ...buildBasePayload(), test_email: testEmail.trim() });
      messageApi.success(`Correo de prueba enviado a ${testEmail.trim()} (datos de ${res.center_name})`);
      setTestModalOpen(false);
      setTestEmail('');
    } catch (err) {
      messageApi.error(getErrorMessage(err, 'Error al enviar el correo de prueba'));
    }
  };

  const previewLabels: Record<ReportAttachmentType, string> = {
    dedication: 'Dedicacion',
    dedication_passwords: 'Dedicacion con claves',
    certification: 'Certificado',
  };

  const handlePreview = async (group: ReportSendGroupPreview, type: ReportAttachmentType) => {
    const keys = type === 'certification' ? group.eligible_row_keys : group.row_keys;
    if (!keys.length) { messageApi.warning('No hay alumnos elegibles para este informe en este grupo'); return; }
    try {
      await exportPdf({
        selected_keys: keys,
        report_type: type === 'certification' ? 'certification' : undefined,
        include_passwords: type === 'dedication_passwords',
        filename: `${group.center_name} - ${previewLabels[type]}.pdf`,
      });
    } catch {
      messageApi.error('No se pudo generar la vista previa del PDF');
    }
  };

  return (
    <>
      <Modal
        title="Enviar informe a centros"
        open={open && !resultModalOpen}
        onCancel={onCancel}
        width={720}
        footer={[
          <Button key="cancel" onClick={onCancel}>Cancelar</Button>,
          <Button key="test" onClick={() => setTestModalOpen(true)} disabled={!groups.length}>Enviar prueba</Button>,
          <Button key="submit" type="primary" loading={isSending} disabled={groupsLoading || !groups.length} onClick={handleSend}>Enviar</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Informes a adjuntar" required>
            <Space direction="vertical">
              <Checkbox checked={attachDedication} onChange={(e) => setAttachDedication(e.target.checked)}>
                Dedicación (todos los alumnos seleccionados de cada grupo)
              </Checkbox>
              <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
                <Checkbox checked={attachDedicationPasswords} onChange={(e) => setAttachDedicationPasswords(e.target.checked)}>
                  Dedicación con usuario/clave de Moodle (PDF aparte, acción sensible)
                </Checkbox>
              </AuthzHide>
              <Checkbox checked={attachCertification} onChange={(e) => setAttachCertification(e.target.checked)}>
                Certificado (solo alumnos ≥75% de finalización de cada grupo)
              </Checkbox>
            </Space>
          </Form.Item>

          <Form.Item label="Destinatarios por petición" required>
            {groupsLoading && <Typography.Text type="secondary">Cargando alumnos seleccionados…</Typography.Text>}
            {unassignableCount > 0 && (
              <div style={{ color: token.colorWarning, fontSize: 12, marginBottom: 8 }}>
                {unassignableCount} alumno(s) sin petición ni centro asociado — no se les puede enviar nada, se omiten.
              </div>
            )}
            {groups.map((g) => (
              <SendGroupRecipientRow
                key={g.group_key}
                group={g}
                emails={recipientsByGroup[g.group_key] ?? []}
                onChange={(emails) => setRecipientsByGroup((prev) => ({ ...prev, [g.group_key]: emails }))}
                attachDedication={attachDedication}
                attachDedicationPasswords={attachDedicationPasswords}
                attachCertification={attachCertification}
                onPreview={(type) => handlePreview(g, type)}
              />
            ))}
          </Form.Item>

          <Form.Item label="Remitente" required>
            <Radio.Group value={fromChoice} onChange={(e) => setFromChoice(e.target.value)}>
              <Space direction="vertical">
                <Radio value="default">Remitente por defecto ({smtp?.from_email || 'no configurado'})</Radio>
                <Radio value="auth">Email del usuario autenticado ({authEmail || 'sin email'})</Radio>
                <Radio value="manual">Remitente manual</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {fromChoice === 'manual' && (
            <Form.Item label="Datos del remitente manual" required>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input
                  placeholder="Nombre a mostrar (opcional)"
                  value={manualFromName}
                  onChange={(e) => setManualFromName(e.target.value)}
                />
                <Input
                  placeholder="Email de respuesta (Responder a)"
                  value={manualReplyTo}
                  onChange={(e) => setManualReplyTo(e.target.value)}
                />
              </Space>
              <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>
                El correo se sigue enviando desde {smtp?.from_email || 'la cuenta SMTP configurada'} (por entregabilidad); el nombre mostrado y "Responder a" sí se pueden personalizar.
              </div>
            </Form.Item>
          )}

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
                  <Select.Option key={template.id} value={template.id}>{template.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {sendMode === 'custom' && (
            <>
              <Form.Item label="Asunto" required>
                <Input placeholder="Asunto del correo" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} />
              </Form.Item>
              <Form.Item label="Formato" required>
                <Radio.Group value={customIsHtml ? 'html' : 'text'} onChange={(e) => setCustomIsHtml(e.target.value === 'html')}>
                  <Radio value="text">Texto</Radio>
                  <Radio value="html">HTML</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item label="Contenido" required>
                <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                  {REPORT_MAIL_TEMPLATE_VARIABLES.map((v) => (
                    <Tooltip title={v.label} key={v.key}>
                      <Button
                        size="small"
                        type="text"
                        style={{ fontSize: 11, padding: '0 6px', height: 22, lineHeight: '20px' }}
                        onClick={() => {
                          if (customIsHtml && htmlEditorRef.current) {
                            htmlEditorRef.current.chain().focus().insertContent(v.key).run();
                          } else {
                            setCustomContent((c) => `${c}${v.key}`);
                          }
                        }}
                      >
                        {v.key}
                      </Button>
                    </Tooltip>
                  ))}
                </Space>
                {customIsHtml ? (
                  <MailTemplateHtmlEditor
                    value={customContent}
                    onChange={setCustomContent}
                    onReady={(editor) => { htmlEditorRef.current = editor; }}
                    onUploadImage={async (file) => (await uploadImage(file)).url}
                  />
                ) : (
                  <Input.TextArea rows={6} placeholder="Escribe el contenido del correo" value={customContent} onChange={(e) => setCustomContent(e.target.value)} />
                )}
              </Form.Item>
            </>
          )}

          {sendMode === 'template' && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Collapse
                items={[{
                  key: 'preview',
                  label: 'Vista previa del correo (aproximada; cada grupo recibe sus propios datos)',
                  extra: (
                    <Button
                      size="small"
                      disabled={!selectedTemplateData}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCustomizeFromTemplate();
                      }}
                    >
                      Personalizar
                    </Button>
                  ),
                  children: (
                    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, padding: 12, background: token.colorFillAlter }}>
                      <Typography.Text strong>Asunto:</Typography.Text>
                      <div style={{ marginBottom: 8 }}>{selectedTemplateData?.subject || selectedTemplateData?.name || 'Sin asunto'}</div>
                      <Typography.Text strong>Contenido:</Typography.Text>
                      {selectedTemplateData?.is_html ? (
                        <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: selectedTemplateData?.content ?? '' }} />
                      ) : (
                        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedTemplateData?.content || 'Sin contenido'}</div>
                      )}
                    </div>
                  ),
                }]}
                defaultActiveKey={[]}
              />
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="Enviar correo de prueba"
        open={testModalOpen}
        onCancel={() => { setTestModalOpen(false); setTestEmail(''); }}
        onOk={handleSendTest}
        okText="Enviar"
        confirmLoading={isTestSending}
        width={420}
      >
        <Form layout="vertical">
          <Form.Item label="Email de prueba" required>
            <Input placeholder="tucorreo@ejemplo.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} onPressEnter={handleSendTest} />
          </Form.Item>
          <Typography.Text type="secondary">
            Se enviará una única copia (con los adjuntos del primer grupo de la selección) a esta dirección, sin tocar los destinatarios reales.
          </Typography.Text>
        </Form>
      </Modal>

      <Modal
        title="Envío completado"
        open={resultModalOpen}
        onCancel={() => { setResultModalOpen(false); setResults(null); resetState(); onOk?.(); }}
        footer={[
          <Button key="close" type="primary" onClick={() => { setResultModalOpen(false); setResults(null); resetState(); onOk?.(); }}>Cerrar</Button>,
        ]}
        width={520}
      >
        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r) => (
              <div key={r.group_key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: 6 }}>
                <div>
                  <div><strong>{r.center_name}</strong>{r.course_name ? ` — ${r.course_name}` : ''}</div>
                  {r.recipients && <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{r.recipients.join(', ')}</div>}
                  {r.note && <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{r.note}</div>}
                  {r.error && <div style={{ fontSize: 12, color: token.colorError }}>{r.error}</div>}
                </div>
                <Tag color={r.status === 'sent' ? 'green' : r.status === 'failed' ? 'red' : 'default'}>
                  {r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Error' : 'Omitido'}
                </Tag>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
